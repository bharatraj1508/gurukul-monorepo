'use client';

import { Sidepane } from '@/components/sidepanes/Sidepane';
import { SubstitutionBadge } from '@/components/timetable/SubstitutionBadge';
import type { TimetablePeriodSidepanePayload } from '@/lib/store/types/sidepane';
import { formatTime } from '@/lib/timetable';
import { BookOpenCheck, Clock, DoorOpen, UserRound } from 'lucide-react';

interface TimetablePeriodSidepaneProps extends TimetablePeriodSidepanePayload {
  isOpen: boolean;
  onClose: () => void;
}

export function TimetablePeriodSidepane({
  isOpen,
  onClose,
  periodLabel,
  dayLabel,
  startTime,
  endTime,
  courseName,
  teacherName,
  roomName,
  substitution,
}: TimetablePeriodSidepaneProps) {
  return (
    <Sidepane
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={courseName}
      description={`${periodLabel} · ${dayLabel}`}
    >
      <div className="space-y-6">
        {/* Period facts */}
        <div className="space-y-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-muted/30 p-4">
          <div className="flex items-center gap-2.5 text-sm">
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="tabular-nums">
              {formatTime(startTime)} – {formatTime(endTime)}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              {substitution ? (
                <>
                  <span className="line-through text-muted-foreground mr-2">
                    {teacherName ?? 'Unassigned'}
                  </span>
                  {substitution.teacherName}
                </>
              ) : (
                (teacherName ?? 'Unassigned')
              )}
            </span>
          </div>
          {roomName && (
            <div className="flex items-center gap-2.5 text-sm">
              <DoorOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{roomName}</span>
            </div>
          )}
          {substitution && (
            <div className="pt-1">
              <SubstitutionBadge
                teacherName={substitution.teacherName}
                reason={substitution.reason}
              />
              {substitution.reason && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {substitution.reason}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Work Diary / Homework — designed empty state (features not built yet) */}
        <div>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Work Diary & Homework
          </h3>
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 px-6 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <BookOpenCheck className="h-6 w-6 text-primary opacity-80" />
            </div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Nothing here yet
            </p>
            <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
              Lesson notes and homework for this period will appear here once
              teachers start posting them.
            </p>
          </div>
        </div>
      </div>
    </Sidepane>
  );
}
