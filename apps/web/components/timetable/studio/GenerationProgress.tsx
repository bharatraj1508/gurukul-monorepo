'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import type {
  TimetableDetail,
  TimetableFailureHint,
} from '@/services/api/requests/timetables';
import { AlertTriangle, Loader2, Settings2, Sparkles } from 'lucide-react';

// Where to send the admin for each actionable failure hint.
const HINT_SETUP_LINKS: Record<string, { href: string; label: string }> = {
  TEACHER_OVERLOADED: {
    href: '/academics/timetable/setup/constraints',
    label: 'Review teacher constraints',
  },
  AVAILABILITY_CONFLICT: {
    href: '/academics/timetable/setup/constraints',
    label: 'Review teacher availability',
  },
  CLASS_OVERALLOCATED: {
    href: '/academics/timetable/setup/allocations',
    label: 'Review subject allocations',
  },
  BLOCK_SIZE_IMPOSSIBLE: {
    href: '/academics/timetable/setup/allocations',
    label: 'Review lab blocks',
  },
  ROOM_TYPE_SCARCE: {
    href: '/academics/timetable/setup/rooms',
    label: 'Review rooms',
  },
};

interface GenerationProgressProps {
  timetable: TimetableDetail;
  onRegenerate?: () => void;
}

export function GenerationProgress({
  timetable,
  onRegenerate,
}: GenerationProgressProps) {
  if (timetable.status === 'GENERATING') {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 px-6 py-20 text-center">
        <div className="relative mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <Loader2 className="absolute -bottom-1 -right-1 h-6 w-6 animate-spin text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Solving your timetable…
        </h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          The constraint solver is placing every lesson without clashes. This
          usually takes under a couple of minutes — this page refreshes on its
          own.
        </p>
      </div>
    );
  }

  // FAILED: render the actionable hints.
  return (
    <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Generation failed
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            The solver could not fit every lesson with the current rules. Fix
            the causes below and re-generate.
          </p>
        </div>
      </div>

      {timetable.failureHints.length > 0 ? (
        <ul className="mt-5 space-y-2">
          {timetable.failureHints.map((hint, index) => (
            <FailureHintRow key={`${hint.code}-${index}`} hint={hint} />
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          No specific cause was identified. Try relaxing teacher limits or
          reducing weekly periods, then re-generate.
        </p>
      )}

      {onRegenerate && (
        <div className="mt-6">
          <Button onClick={onRegenerate} className="gap-2">
            <Sparkles className="h-4 w-4" /> Re-generate
          </Button>
        </div>
      )}
    </div>
  );
}

function FailureHintRow({ hint }: { hint: TimetableFailureHint }) {
  const link = HINT_SETUP_LINKS[hint.code];
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-red-200/70 dark:border-red-900/40 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {hint.message}
        </p>
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {hint.code}
        </p>
      </div>
      {link && (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
        >
          <Link href={link.href}>
            <Settings2 className="h-3.5 w-3.5" />
            {link.label}
          </Link>
        </Button>
      )}
    </li>
  );
}
