'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ArrowLeftRight } from 'lucide-react';

interface SubstitutionBadgeProps {
  teacherName: string;
  reason?: string | null;
  compact?: boolean;
  className?: string;
}

export function SubstitutionBadge({
  teacherName,
  reason,
  compact = false,
  className,
}: SubstitutionBadgeProps) {
  return (
    <Badge
      variant="outline"
      title={reason ? `Substitution: ${reason}` : 'Substitution'}
      className={cn(
        'gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium',
        compact ? 'px-1.5 py-0 text-[9px]' : 'text-[10px]',
        className,
      )}
    >
      <ArrowLeftRight className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {compact ? 'Sub' : `Substituted · ${teacherName}`}
    </Badge>
  );
}
