'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LessonPlanStatus } from '@/services/api/requests/lesson-plans';

interface LessonPlanStatusBadgeProps {
  status: string | LessonPlanStatus;
  version?: number;
  className?: string;
}

export function LessonPlanStatusBadge({ status, version, className }: LessonPlanStatusBadgeProps) {
  const getBadgeVariant = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
      case 'SUBMITTED':
        return 'bg-amber-100 text-amber-700 hover:bg-amber-200';
      case 'APPROVED':
        return 'bg-green-100 text-green-700 hover:bg-green-200';
      case 'REVISION_REQUESTED':
        return 'bg-red-100 text-red-700 hover:bg-red-200';
      default:
        return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'REVISION_REQUESTED':
        return 'Revision Requested';
      default:
        return status.charAt(0) + status.slice(1).toLowerCase();
    }
  };

  return (
    <Badge variant="outline" className={cn("font-medium border-0", getBadgeVariant(status), className)}>
      {getStatusLabel(status)}
      {version !== undefined && ` (v${version})`}
    </Badge>
  );
}
