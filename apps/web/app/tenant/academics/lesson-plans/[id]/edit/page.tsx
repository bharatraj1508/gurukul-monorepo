'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useLessonPlan } from '@/services/api/requests/lesson-plans';
import LessonPlanBuilderContainer from '@/containers/Tenant/LessonPlans/LessonPlanBuilder';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditLessonPlanPage() {
  const params = useParams();
  const id = params?.id as string;
  const { data: plan, isLoading } = useLessonPlan(id, !!id);

  if (isLoading || !plan) {
    return (
      <div className="max-w-5xl mx-auto p-8 space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return <LessonPlanBuilderContainer existingPlan={plan} />;
}
