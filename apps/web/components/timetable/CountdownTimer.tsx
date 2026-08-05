'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  /** Epoch ms to count down to. Renders nothing when null or in the past. */
  target: number | null;
  prefix?: string;
  className?: string;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * The only component in the timetable tree that ticks every second — keep it
 * a leaf so the 1s interval never re-renders the surrounding schedule.
 */
export function CountdownTimer({
  target,
  prefix,
  className,
}: CountdownTimerProps) {
  const [remainingMs, setRemainingMs] = useState<number | null>(() =>
    target != null ? target - Date.now() : null,
  );

  useEffect(() => {
    if (target == null) {
      setRemainingMs(null);
      return;
    }
    setRemainingMs(target - Date.now());
    const interval = setInterval(() => {
      setRemainingMs(target - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (target == null || remainingMs == null || remainingMs <= 0) return null;

  return (
    <span className={cn('tabular-nums font-medium', className)}>
      {prefix}
      {formatRemaining(remainingMs)}
    </span>
  );
}
