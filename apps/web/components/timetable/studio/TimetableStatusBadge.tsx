'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TimetableStatus } from '@/services/api/requests/timetables';
import {
  Archive,
  CheckCircle2,
  Loader2,
  PencilLine,
  XCircle,
} from 'lucide-react';

const STATUS_STYLES: Record<TimetableStatus, string> = {
  GENERATING:
    'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',
  DRAFT: 'text-sky-600 bg-sky-50 dark:bg-sky-900/20 dark:text-sky-400',
  PUBLISHED:
    'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400',
  ARCHIVED: 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800/60 dark:text-zinc-400',
  FAILED: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
};

const STATUS_ICONS: Record<TimetableStatus, React.ElementType> = {
  GENERATING: Loader2,
  DRAFT: PencilLine,
  PUBLISHED: CheckCircle2,
  ARCHIVED: Archive,
  FAILED: XCircle,
};

export function TimetableStatusBadge({
  status,
  className,
}: {
  status: TimetableStatus;
  className?: string;
}) {
  const Icon = STATUS_ICONS[status];
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-none gap-1 text-[10px] font-semibold tracking-wider',
        STATUS_STYLES[status],
        className,
      )}
    >
      <Icon
        className={cn('w-3 h-3', status === 'GENERATING' && 'animate-spin')}
      />
      {status}
    </Badge>
  );
}
