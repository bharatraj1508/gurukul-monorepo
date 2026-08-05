'use client';

import { memo, useMemo } from 'react';

import { ISO_DAY_SHORT, courseColorClasses, formatTime } from '@/lib/timetable';
import { cn } from '@/lib/utils';
import type {
  TimetableViewDay,
  TimetableViewEntry,
  TimetableViewResponse,
  TimetableViewTemplateSlot,
} from '@/services/api/requests/timetables';
import { format, parseISO } from 'date-fns';

export interface WeeklyGridProps {
  view: TimetableViewResponse;
  /** ISO day highlighted as today, when it falls inside this week. */
  todayIsoDay?: number | null;
  onPeriodClick?: (
    day: TimetableViewDay,
    templateSlot: TimetableViewTemplateSlot,
    entry: TimetableViewEntry,
  ) => void;
}

export function WeeklyGrid({
  view,
  todayIsoDay,
  onPeriodClick,
}: WeeklyGridProps) {
  // Columns always come from the template's working days — never hardcoded.
  const days = useMemo(() => {
    const byDay = new Map(view.days.map((day) => [day.dayOfWeek, day]));
    return view.periodTemplate.workingDays.map(
      (dayOfWeek) =>
        byDay.get(dayOfWeek) ?? { dayOfWeek, date: '', entries: [] },
    );
  }, [view]);

  const templateRows = useMemo(
    () =>
      [...view.periodTemplate.slots].sort((a, b) => a.sortOrder - b.sortOrder),
    [view],
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="bg-zinc-50 dark:bg-zinc-900/60">
            <th className="w-32 border-b border-r border-zinc-200 dark:border-zinc-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Period
            </th>
            {days.map((day) => (
              <th
                key={day.dayOfWeek}
                className={cn(
                  'border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 text-center',
                  todayIsoDay === day.dayOfWeek && 'bg-primary/10',
                )}
              >
                <span className="block text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                  {ISO_DAY_SHORT[day.dayOfWeek]}
                </span>
                {day.date && (
                  <span className="block text-[10px] text-muted-foreground">
                    {format(parseISO(day.date), 'd MMM')}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {templateRows.map((slot) => {
            if (slot.kind !== 'PERIOD') {
              return (
                <tr key={slot.sortOrder}>
                  <td
                    colSpan={days.length + 1}
                    className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 px-3 py-1 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground"
                  >
                    {slot.label} · {formatTime(slot.startTime)} –{' '}
                    {formatTime(slot.endTime)}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={slot.sortOrder}>
                <td className="border-b border-r border-zinc-200 dark:border-zinc-800 px-3 py-1.5 align-top">
                  <span className="block text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                    {slot.label}
                  </span>
                  <span className="block text-[10px] tabular-nums text-muted-foreground">
                    {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                  </span>
                </td>
                {days.map((day) => {
                  const entry =
                    day.entries.find(
                      (candidate) =>
                        candidate.periodNumber === slot.periodNumber,
                    ) ?? null;
                  return (
                    <PeriodCell
                      key={`${day.dayOfWeek}-${slot.sortOrder}`}
                      entry={entry}
                      isToday={todayIsoDay === day.dayOfWeek}
                      onClick={
                        entry && onPeriodClick
                          ? () => onPeriodClick(day, slot, entry)
                          : undefined
                      }
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface PeriodCellProps {
  entry: TimetableViewEntry | null;
  isToday: boolean;
  onClick?: () => void;
}

const PeriodCell = memo(function PeriodCell({
  entry,
  isToday,
  onClick,
}: PeriodCellProps) {
  return (
    <td
      className={cn(
        'border-b border-zinc-200 dark:border-zinc-800 p-1 align-top',
        isToday && 'bg-primary/5',
      )}
    >
      {entry ? (
        <button
          type="button"
          onClick={onClick}
          disabled={!onClick}
          className={cn(
            'flex w-full flex-col gap-0.5 rounded-md border px-2 py-1.5 text-left transition-shadow',
            onClick && 'cursor-pointer hover:shadow-sm',
            courseColorClasses(entry.course.id),
          )}
        >
          <span className="truncate text-[11px] font-semibold leading-tight">
            {entry.course.name}
          </span>
          <span className="truncate text-[10px] opacity-80">
            {entry.class
              ? entry.class.name
              : entry.substitution
                ? entry.substitution.teacherName
                : (entry.teacher?.name ?? '')}
            {entry.room ? ` · ${entry.room.name}` : ''}
          </span>
          {entry.substitution && (
            <span className="inline-flex w-fit items-center rounded-full bg-amber-500/20 px-1.5 text-[8px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Sub
            </span>
          )}
        </button>
      ) : (
        <div className="h-full min-h-10 rounded-md" />
      )}
    </td>
  );
});
