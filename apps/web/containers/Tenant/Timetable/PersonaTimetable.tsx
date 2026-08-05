'use client';

import { useMemo, useState } from 'react';

import { DailyTimeline } from '@/components/timetable/DailyTimeline';
import { TimetablePrintSheet } from '@/components/timetable/TimetablePrintSheet';
import { WeeklyGrid } from '@/components/timetable/WeeklyGrid';
import { Button } from '@/components/ui/button';
import { useShowTimetablePeriodSidepane } from '@/hooks/use-sidepane';
import { useTimetablePrint } from '@/hooks/use-timetable-print';
import {
  type DayScheduleRow,
  ISO_DAY_LABELS,
  ISO_DAY_SHORT,
  buildDaySchedule,
  getIsoDay,
  getWeekStartISO,
  resolveNow,
  shiftWeekStart,
} from '@/lib/timetable';
import { cn } from '@/lib/utils';
import type {
  TimetableViewDay,
  TimetableViewEntry,
  TimetableViewResponse,
  TimetableViewTemplateSlot,
} from '@/services/api/requests/timetables';
import { addDays, format, parseISO } from 'date-fns';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Printer,
} from 'lucide-react';

interface PersonaTimetableProps {
  view: TimetableViewResponse | null | undefined;
  isLoading: boolean;
  weekStart: string;
  onWeekStartChange: (weekStart: string) => void;
  /** Shown on the print sheet, e.g. the student's or teacher's name. */
  printSubjectLabel: string;
  emptyTitle: string;
  emptySubtitle: string;
}

export function PersonaTimetable({
  view,
  isLoading,
  weekStart,
  onWeekStartChange,
  printSubjectLabel,
  emptyTitle,
  emptySubtitle,
}: PersonaTimetableProps) {
  const print = useTimetablePrint();
  const showPeriodSidepane = useShowTimetablePeriodSidepane();

  const isCurrentWeek = weekStart === getWeekStartISO(resolveNow());
  const todayIsoDay = getIsoDay(resolveNow());

  const workingDays = useMemo(
    () => view?.periodTemplate.workingDays ?? [],
    [view],
  );

  const [selectedDayOverride, setSelectedDayOverride] = useState<number | null>(
    null,
  );
  const selectedDay =
    selectedDayOverride != null && workingDays.includes(selectedDayOverride)
      ? selectedDayOverride
      : workingDays.includes(todayIsoDay)
        ? todayIsoDay
        : (workingDays[0] ?? null);

  const selectedDayData: TimetableViewDay | null = useMemo(
    () => view?.days.find((day) => day.dayOfWeek === selectedDay) ?? null,
    [view, selectedDay],
  );

  const dayRows = useMemo<DayScheduleRow[]>(
    () =>
      view
        ? buildDaySchedule(
            view.periodTemplate.slots,
            selectedDayData?.entries ?? [],
          )
        : [],
    [view, selectedDayData],
  );

  const stepDay = (delta: number) => {
    if (selectedDay == null || workingDays.length === 0) return;
    const index = workingDays.indexOf(selectedDay);
    const nextIndex = Math.min(
      Math.max(index + delta, 0),
      workingDays.length - 1,
    );
    const nextDay = workingDays[nextIndex];
    if (nextDay != null) setSelectedDayOverride(nextDay);
  };

  const openPeriod = (
    row: {
      label: string;
      startTime: string;
      endTime: string;
    },
    entry: TimetableViewEntry,
    dayOfWeek: number,
    dateISO?: string,
  ) => {
    showPeriodSidepane({
      periodLabel: row.label,
      dayLabel: dateISO
        ? format(parseISO(dateISO), 'EEEE, d MMM')
        : (ISO_DAY_LABELS[dayOfWeek] ?? ''),
      startTime: row.startTime,
      endTime: row.endTime,
      courseName: entry.class
        ? `${entry.course.name} · ${entry.class.name}`
        : entry.course.name,
      teacherName: entry.teacher?.name ?? null,
      roomName: entry.room?.name ?? null,
      substitution: entry.substitution ?? null,
    });
  };

  const weekRangeLabel = useMemo(() => {
    const start = parseISO(weekStart);
    const end = addDays(start, 6);
    return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`;
  }, [weekStart]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-64 rounded-lg bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-14 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!view) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <CalendarClock className="h-8 w-8 text-primary opacity-80" />
        </div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
          {emptyTitle}
        </h3>
        <p className="text-zinc-500 max-w-sm">{emptySubtitle}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Week navigation + print */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Previous week"
            onClick={() => onWeekStartChange(shiftWeekStart(weekStart, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="px-2 text-center">
            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">
              {weekRangeLabel}
            </p>
            {!isCurrentWeek && (
              <button
                type="button"
                onClick={() => onWeekStartChange(getWeekStartISO(resolveNow()))}
                className="text-[10px] font-medium text-primary hover:underline"
              >
                Back to this week
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Next week"
            onClick={() => onWeekStartChange(shiftWeekStart(weekStart, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" size="sm" className="gap-2" onClick={print}>
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>

      {/* Day chip strip — a11y alternative to swiping */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
        {workingDays.map((dayOfWeek) => {
          const dayData = view.days.find((d) => d.dayOfWeek === dayOfWeek);
          const isSelected = selectedDay === dayOfWeek;
          const isTodayChip = isCurrentWeek && todayIsoDay === dayOfWeek;
          return (
            <button
              key={dayOfWeek}
              type="button"
              onClick={() => setSelectedDayOverride(dayOfWeek)}
              className={cn(
                'flex min-w-14 flex-col items-center rounded-lg border px-3 py-1.5 transition-colors',
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-zinc-200 dark:border-zinc-800 text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider">
                {ISO_DAY_SHORT[dayOfWeek]}
              </span>
              {dayData?.date && (
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    isTodayChip && 'font-bold',
                  )}
                >
                  {format(parseISO(dayData.date), 'd')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Daily timeline */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {selectedDay != null ? ISO_DAY_LABELS[selectedDay] : 'Day'} schedule
        </h2>
        <DailyTimeline
          rows={dayRows}
          workingDays={workingDays}
          isToday={isCurrentWeek && selectedDay === todayIsoDay}
          onPeriodClick={(row) => {
            if (!row.entry || selectedDay == null) return;
            openPeriod(
              row,
              row.entry,
              selectedDay,
              selectedDayData?.date || undefined,
            );
          }}
          onSwipePrev={() => stepDay(-1)}
          onSwipeNext={() => stepDay(1)}
        />
      </section>

      {/* Weekly grid */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Week at a glance
        </h2>
        <WeeklyGrid
          view={view}
          todayIsoDay={isCurrentWeek ? todayIsoDay : null}
          onPeriodClick={(
            day: TimetableViewDay,
            templateSlot: TimetableViewTemplateSlot,
            entry: TimetableViewEntry,
          ) =>
            openPeriod(
              templateSlot,
              entry,
              day.dayOfWeek,
              day.date || undefined,
            )
          }
        />
      </section>

      <TimetablePrintSheet view={view} subjectLabel={printSubjectLabel} />
    </div>
  );
}
