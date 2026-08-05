'use client';

import { useEffect, useState } from 'react';

import {
  type CurrentPeriodSnapshot,
  type DayScheduleRow,
  computeCurrentPeriod,
  resolveNow,
} from '@/lib/timetable';

const IDLE_SNAPSHOT: CurrentPeriodSnapshot = {
  phase: 'OFF',
  activeRowKey: null,
  nextRowKey: null,
  nextBoundaryAt: null,
};

/**
 * Live schedule state for a day's rows. Instead of ticking every second, it
 * computes the current phase and schedules a single timeout for the next
 * schedule boundary (a handful of re-renders per day). Re-syncs when the tab
 * becomes visible again, since timers are throttled in background tabs.
 *
 * Callers should memoize `rows` and `workingDays` — the effect re-arms when
 * their identity changes.
 */
export function useCurrentPeriod(
  rows: DayScheduleRow[],
  workingDays: number[],
  enabled = true,
): CurrentPeriodSnapshot {
  const [snapshot, setSnapshot] = useState<CurrentPeriodSnapshot>(() =>
    enabled
      ? computeCurrentPeriod(rows, workingDays, resolveNow())
      : IDLE_SNAPSHOT,
  );

  useEffect(() => {
    if (!enabled) {
      setSnapshot(IDLE_SNAPSHOT);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    const sync = () => {
      if (timer) clearTimeout(timer);
      const next = computeCurrentPeriod(rows, workingDays, resolveNow());
      setSnapshot(next);
      if (next.nextBoundaryAt != null) {
        // Small buffer past the boundary so the recompute lands on the far side.
        const delay = Math.max(next.nextBoundaryAt - Date.now(), 1000) + 500;
        timer = setTimeout(sync, delay);
      }
    };

    sync();

    const onVisibilityChange = () => {
      if (!document.hidden) sync();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [rows, workingDays, enabled]);

  return snapshot;
}
