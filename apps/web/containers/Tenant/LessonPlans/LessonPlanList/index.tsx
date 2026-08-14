'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Plus, Eye, ClipboardList, Filter } from 'lucide-react';

import { useLessonPlans, LessonPlanFilters, LessonPlanStatus } from '@/services/api/requests/lesson-plans';
import { useAcademicTerms } from '@/services/api/requests/academic-terms';
import { useClasses } from '@/services/api/requests/classes';
import { usePermission } from '@/hooks/use-permission';
import { PERMS } from '@repo/permissions';

import { LessonPlanStatusBadge } from '../LessonPlanStatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function LessonPlanList() {
  const router = useRouter();
  const { hasPermission } = usePermission();
  const canCreate = hasPermission(PERMS.lessonPlan.create);
  const canApprove = hasPermission(PERMS.lessonPlan.approve);

  const [filters, setFilters] = useState<LessonPlanFilters>({
    status: '',
    academicTermId: '',
    classId: '',
  });

  const { data: lessonPlans, isLoading } = useLessonPlans(filters);
  const { data: terms } = useAcademicTerms();
  const { data: classes } = useClasses();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lesson Plans</h1>
          <p className="text-muted-foreground">Manage and track lesson plans across all classes.</p>
        </div>
        <div className="flex gap-2">
          {canApprove && (
            <Button variant="outline" onClick={() => router.push('/academics/lesson-plans/review')}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Review Queue
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => router.push('/academics/lesson-plans/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Create Lesson Plan
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              value={filters.status || 'ALL'}
              onValueChange={(val) => setFilters(prev => ({ ...prev, status: val === 'ALL' ? '' : (val as LessonPlanStatus) }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REVISION_REQUESTED">Revision Requested</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.academicTermId || 'ALL'}
              onValueChange={(val) => setFilters(prev => ({ ...prev, academicTermId: val === 'ALL' ? '' : val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Academic Terms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Academic Terms</SelectItem>
                {terms?.map(term => (
                  <SelectItem key={term.id} value={term.id}>{term.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.classId || 'ALL'}
              onValueChange={(val) => setFilters(prev => ({ ...prev, classId: val === 'ALL' ? '' : val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Classes</SelectItem>
                {classes?.map(cls => (
                  <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : lessonPlans?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No lesson plans found.
                  </TableCell>
                </TableRow>
              ) : (
                lessonPlans?.map((plan) => (
                  <TableRow 
                    key={plan.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/academics/lesson-plans/${plan.id}`)}
                  >
                    <TableCell className="font-medium">
                      {plan.planType === 'WEEKLY' ? `Week ${plan.weekNumber}` : `Month ${plan.month}`} ({plan.year})
                    </TableCell>
                    <TableCell>{plan.class?.name || '-'}</TableCell>
                    <TableCell>{plan.course?.name || '-'}</TableCell>
                    <TableCell>
                      <LessonPlanStatusBadge status={plan.status} version={plan.version} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(plan.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/academics/lesson-plans/${plan.id}`);
                      }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default LessonPlanList;
