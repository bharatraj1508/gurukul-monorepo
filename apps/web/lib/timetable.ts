// Pure timetable helpers — no React, no network. Everything time-related
// works on client local wall-clock; `resolveNow` is the single source of
// "now" so a future tenant-timezone setting only needs to change one spot.
import type { PeriodSlotKind } from '@/services/api/requests/timetable-config';
import type {
  TimetableViewEntry,
  TimetableViewTemplateSlot,
} from '@/services/api/requests/timetables';
import { addWeeks, format, parseISO, startOfWeek } from 'date-fns';

export const ISO_DAY_LABELS: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

export const ISO_DAY_SHORT: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

/** The single source of "now" for live indicators. */
export function resolveNow(): Date {
  return new Date();
}

/** ISO weekday (1=Monday..7=Sunday) for a Date. */
export function getIsoDay(date: Date): number {
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

/** "HH:mm" -> minutes since midnight. */
export function timeToMinutes(hhmm: string): number {
  const [hours = 0, minutes = 0] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

/** "HH:mm" (24h) -> "h:mm AM/PM". */
export function formatTime(hhmm: string): string {
  const total = timeToMinutes(hhmm);
  const hours24 = Math.floor(total / 60);
  const minutes = total % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/** Monday of the week containing `date`, as "yyyy-MM-dd". */
export function getWeekStartISO(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

export function shiftWeekStart(
  weekStartISO: string,
  deltaWeeks: number,
): string {
  return format(addWeeks(parseISO(weekStartISO), deltaWeeks), 'yyyy-MM-dd');
}

export function formatDayDate(dateISO: string): string {
  return format(parseISO(dateISO), 'EEE, d MMM');
}

// ---------------------------------------------------------------------------
// Day schedule: template slots merged with the day's timetable entries.
// Breaks live only on the template, so viewers always merge the two.
// ---------------------------------------------------------------------------

export interface DayScheduleRow {
  key: string;
  kind: PeriodSlotKind;
  label: string;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  periodNumber: number | null;
  entry: TimetableViewEntry | null;
}

export function buildDaySchedule(
  templateSlots: TimetableViewTemplateSlot[],
  entries: TimetableViewEntry[],
): DayScheduleRow[] {
  const entriesByPeriod = new Map(
    entries.map((entry) => [entry.periodNumber, entry]),
  );
  return [...templateSlots]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((slot) => ({
      key: `row-${slot.sortOrder}`,
      kind: slot.kind,
      label: slot.label,
      startTime: slot.startTime,
      endTime: slot.endTime,
      startMinutes: timeToMinutes(slot.startTime),
      endMinutes: timeToMinutes(slot.endTime),
      periodNumber: slot.periodNumber,
      entry:
        slot.periodNumber != null
          ? (entriesByPeriod.get(slot.periodNumber) ?? null)
          : null,
    }));
}

// ---------------------------------------------------------------------------
// Live period computation. Consumers re-run this at schedule boundaries via
// hooks/use-current-period.ts rather than ticking every second.
// ---------------------------------------------------------------------------

export type SchedulePhase =
  | 'OFF' // weekday not in workingDays, or empty schedule
  | 'BEFORE' // before the first slot of the day
  | 'IN_SESSION' // inside a slot (period or break)
  | 'BETWEEN' // in a gap between two slots
  | 'AFTER'; // past the last slot

export interface CurrentPeriodSnapshot {
  phase: SchedulePhase;
  /** Row currently in session (period, break, lunch, assembly). */
  activeRowKey: string | null;
  /** Next row that has not started yet. */
  nextRowKey: string | null;
  /** Epoch ms of the next schedule boundary today, null when none remain. */
  nextBoundaryAt: number | null;
}

export function computeCurrentPeriod(
  rows: DayScheduleRow[],
  workingDays: number[],
  now: Date,
): CurrentPeriodSnapshot {
  const off: CurrentPeriodSnapshot = {
    phase: 'OFF',
    activeRowKey: null,
    nextRowKey: null,
    nextBoundaryAt: null,
  };
  if (rows.length === 0 || !workingDays.includes(getIsoDay(now))) return off;

  const minutesNow =
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  const sorted = [...rows].sort((a, b) => a.startMinutes - b.startMinutes);
  const activeRow = sorted.find(
    (row) => minutesNow >= row.startMinutes && minutesNow < row.endMinutes,
  );
  const nextRow = sorted.find((row) => row.startMinutes > minutesNow);

  let nextBoundaryMinutes: number | null = null;
  if (activeRow) {
    nextBoundaryMinutes = activeRow.endMinutes;
  } else if (nextRow) {
    nextBoundaryMinutes = nextRow.startMinutes;
  }

  let phase: SchedulePhase;
  if (activeRow) phase = 'IN_SESSION';
  else if (!nextRow) phase = 'AFTER';
  else if (sorted[0] && minutesNow < sorted[0].startMinutes) phase = 'BEFORE';
  else phase = 'BETWEEN';

  return {
    phase,
    activeRowKey: activeRow?.key ?? null,
    nextRowKey: nextRow?.key ?? null,
    nextBoundaryAt:
      nextBoundaryMinutes != null
        ? minutesToEpoch(now, nextBoundaryMinutes)
        : null,
  };
}

function minutesToEpoch(day: Date, minutesOfDay: number): number {
  const boundary = new Date(day);
  boundary.setHours(
    Math.floor(minutesOfDay / 60),
    Math.round(minutesOfDay % 60),
    0,
    0,
  );
  return boundary.getTime();
}

// ---------------------------------------------------------------------------
// Deterministic course colors: hash the course id into a fixed palette so a
// course keeps its color across every grid without any stored mapping.
// ---------------------------------------------------------------------------

const COURSE_PALETTE = [
  'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/40',
  'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40',
  'bg-violet-500/15 text-violet-800 dark:text-violet-300 border-violet-500/40',
  'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40',
  'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/40',
  'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-500/40',
  'bg-lime-500/15 text-lime-800 dark:text-lime-300 border-lime-500/40',
  'bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-300 border-fuchsia-500/40',
  'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-500/40',
  'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/40',
];

export function courseColorClasses(courseId: string): string {
  let hash = 0;
  for (let i = 0; i < courseId.length; i++) {
    hash = (hash * 31 + courseId.charCodeAt(i)) >>> 0;
  }
  return COURSE_PALETTE[hash % COURSE_PALETTE.length] as string;
}

/** Teaching period numbers of a template, in day order. */
export function templatePeriodNumbers(
  slots: {
    kind: PeriodSlotKind;
    periodNumber: number | null;
    sortOrder: number;
  }[],
): number[] {
  return [...slots]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((slot) => slot.kind === 'PERIOD' && slot.periodNumber != null)
    .map((slot) => slot.periodNumber as number);
}
