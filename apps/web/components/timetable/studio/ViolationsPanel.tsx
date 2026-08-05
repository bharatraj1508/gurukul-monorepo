'use client';

import { cn } from '@/lib/utils';
import type { TimetableViolation } from '@/services/api/requests/timetables';
import { CheckCircle2, TriangleAlert } from 'lucide-react';

interface ViolationsPanelProps {
  violations: TimetableViolation[];
  selectedIndex: number | null;
  onSelect: (violation: TimetableViolation, index: number) => void;
}

/**
 * Soft-constraint warnings reported by the solver. Clicking a row highlights
 * (and scrolls to) the first matching slot in the MasterGrid.
 */
export function ViolationsPanel({
  violations,
  selectedIndex,
  onSelect,
}: ViolationsPanelProps) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-card">
      <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Warnings{violations.length > 0 ? ` (${violations.length})` : ''}
        </h3>
      </div>
      {violations.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-8 text-center">
          <CheckCircle2 className="mb-2 h-6 w-6 text-emerald-500" />
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            No soft-constraint warnings
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The solver met every scheduling preference.
          </p>
        </div>
      ) : (
        <ul className="max-h-[420px] divide-y divide-zinc-100 dark:divide-zinc-800/60 overflow-y-auto">
          {violations.map((violation, index) => (
            <li key={`${violation.code}-${index}`}>
              <button
                type="button"
                onClick={() => onSelect(violation, index)}
                className={cn(
                  'flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-muted/50',
                  selectedIndex === index && 'bg-amber-500/10',
                )}
              >
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span className="min-w-0">
                  <span className="block text-xs text-zinc-900 dark:text-zinc-50">
                    {violation.message}
                  </span>
                  <span className="block text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                    {violation.code}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
