'use client';

import { useMemo } from 'react';

import { CountdownTimer } from '@/components/timetable/CountdownTimer';
import { SubstitutionBadge } from '@/components/timetable/SubstitutionBadge';
import { useCurrentPeriod } from '@/hooks/use-current-period';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  type DayScheduleRow,
  courseColorClasses,
  formatTime,
} from '@/lib/timetable';
import { cn } from '@/lib/utils';
import { Coffee, DoorOpen, Megaphone, Moon, Utensils } from 'lucide-react';
import { motion } from 'motion/react';

const NON_PERIOD_ICONS = {
  BREAK: Coffee,
  LUNCH: Utensils,
  ASSEMBLY: Megaphone,
} as const;

export interface DailyTimelineProps {
  rows: DayScheduleRow[];
  workingDays: number[];
  /** Whether this timeline shows today (enables the live indicator). */
  isToday: boolean;
  onPeriodClick?: (row: DayScheduleRow) => void;
  onSwipePrev?: () => void;
  onSwipeNext?: () => void;
}

const SWIPE_OFFSET_THRESHOLD = 64;
const SWIPE_VELOCITY_THRESHOLD = 400;

export function DailyTimeline({
  rows,
  workingDays,
  isToday,
  onPeriodClick,
  onSwipePrev,
  onSwipeNext,
}: DailyTimelineProps) {
  const isMobile = useIsMobile();
  const live = useCurrentPeriod(rows, workingDays, isToday);

  const nextRow = useMemo(
    () => rows.find((row) => row.key === live.nextRowKey) ?? null,
    [rows, live.nextRowKey],
  );

  // Only recomputed when the live snapshot changes (i.e. at boundaries), so
  // "past" dimming stays in sync without a per-second tick.
  const nowMinutes = useMemo(() => {
    if (!isToday || live.phase === 'OFF' || live.phase === 'BEFORE') {
      return Number.NEGATIVE_INFINITY;
    }
    if (live.phase === 'AFTER') return Number.POSITIVE_INFINITY;
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday, live]);

  const countdown =
    isToday && live.nextBoundaryAt != null ? (
      <CountdownTimer
        target={live.nextBoundaryAt}
        prefix={
          live.phase === 'IN_SESSION'
            ? 'Ends in '
            : nextRow
              ? `${nextRow.label} starts in `
              : ''
        }
        className="text-xs text-primary"
      />
    ) : null;

  const content = (
    <ol className="space-y-1.5">
      {rows.map((row) => {
        const isLive = isToday && live.activeRowKey === row.key;
        const isPast = isToday && row.endMinutes <= nowMinutes;

        if (row.kind !== 'PERIOD') {
          const Icon = NON_PERIOD_ICONS[row.kind];
          return (
            <li
              key={row.key}
              className={cn(
                'flex items-center gap-3 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 px-3 py-1.5 text-xs text-muted-foreground',
                isLive && 'border-primary/50 ring-2 ring-primary/30',
              )}
            >
              <span className="w-24 shrink-0 tabular-nums text-[10px]">
                {formatTime(row.startTime)} – {formatTime(row.endTime)}
              </span>
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium uppercase tracking-wider text-[10px]">
                {row.label}
              </span>
              {isLive && <LivePill />}
              {isLive && countdown && (
                <span className="ml-auto">{countdown}</span>
              )}
            </li>
          );
        }

        const entry = row.entry;
        return (
          <li key={row.key}>
            <button
              type="button"
              onClick={() => onPeriodClick?.(row)}
              disabled={!entry || !onPeriodClick}
              className={cn(
                'group w-full text-left flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition-all',
                entry && onPeriodClick && 'cursor-pointer hover:shadow-md',
                isLive
                  ? 'border-primary ring-2 ring-primary/40 shadow-sm'
                  : 'border-zinc-200 dark:border-zinc-800',
                isPast && !isLive && 'opacity-60',
              )}
            >
              <div className="w-24 shrink-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {row.label}
                </p>
                <p className="text-[10px] tabular-nums text-muted-foreground/80">
                  {formatTime(row.startTime)} – {formatTime(row.endTime)}
                </p>
              </div>

              {entry ? (
                <>
                  <span
                    className={cn(
                      'inline-flex h-9 w-1.5 shrink-0 rounded-full border-0',
                      courseColorClasses(entry.course.id),
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {entry.course.name}
                      {entry.class && (
                        <span className="ml-2 text-xs font-medium text-muted-foreground">
                          {entry.class.name}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.substitution
                        ? entry.substitution.teacherName
                        : (entry.teacher?.name ?? 'Unassigned')}
                      {entry.room && (
                        <span className="inline-flex items-center gap-1 ml-2">
                          <DoorOpen className="h-3 w-3" />
                          {entry.room.name}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {entry.substitution && (
                      <SubstitutionBadge
                        teacherName={entry.substitution.teacherName}
                        reason={entry.substitution.reason}
                      />
                    )}
                    {isLive && <LivePill />}
                    {isLive && countdown}
                  </div>
                </>
              ) : (
                <span className="text-xs italic text-muted-foreground">
                  Free period
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 py-12 text-center">
        <Moon className="mb-2 h-6 w-6 text-muted-foreground/60" />
        <p className="text-sm font-medium text-muted-foreground">
          No school today
        </p>
      </div>
    );
  }

  if (isMobile && (onSwipePrev || onSwipeNext)) {
    return (
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={(_event, info) => {
          const { offset, velocity } = info;
          if (
            offset.x < -SWIPE_OFFSET_THRESHOLD ||
            velocity.x < -SWIPE_VELOCITY_THRESHOLD
          ) {
            onSwipeNext?.();
          } else if (
            offset.x > SWIPE_OFFSET_THRESHOLD ||
            velocity.x > SWIPE_VELOCITY_THRESHOLD
          ) {
            onSwipePrev?.();
          }
        }}
        className="touch-pan-y"
      >
        {content}
      </motion.div>
    );
  }

  return content;
}

function LivePill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
      </span>
      Live
    </span>
  );
}
