'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { BookOpen, Edit, Send, Copy, ArrowLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { 
  useLessonPlan, 
  useSubmitLessonPlan, 
  useResubmitLessonPlan, 
  useCloneLessonPlan 
} from '@/services/api/requests/lesson-plans';
import { useClasses } from '@/services/api/requests/classes';
import { useAcademicTerms } from '@/services/api/requests/academic-terms';
import { usePermission } from '@/hooks/use-permission';
import { PERMS } from '@repo/permissions';

import { LessonPlanStatusBadge } from '../LessonPlanStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface LessonPlanDetailProps {
  id: string;
}

export function LessonPlanDetail({ id }: LessonPlanDetailProps) {
  const router = useRouter();
  const { data: plan, isLoading } = useLessonPlan(id);
  const { mutateAsync: submitPlan, isPending: isSubmitting } = useSubmitLessonPlan();
  const { mutateAsync: resubmitPlan, isPending: isResubmitting } = useResubmitLessonPlan();
  const { mutateAsync: clonePlan, isPending: isCloning } = useCloneLessonPlan();

  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneData, setCloneData] = useState({ classId: '', academicTermId: '', note: '' });

  const { data: classes } = useClasses();
  const { data: terms } = useAcademicTerms();

  // Assuming user can edit if they created it (for simplicity, real app would check session user ID vs createdById)
  const { hasPermission } = usePermission();
  const canCreate = hasPermission(PERMS.lessonPlan.create);

  const handleSubmit = async () => {
    try {
      await submitPlan(id);
      toast.success('Lesson plan submitted for review');
    } catch (e) {
      toast.error('Failed to submit lesson plan');
    }
  };

  const handleResubmit = async () => {
    try {
      await resubmitPlan(id);
      toast.success('Lesson plan resubmitted');
    } catch (e) {
      toast.error('Failed to resubmit lesson plan');
    }
  };

  const handleClone = async () => {
    if (!cloneData.classId || !cloneData.academicTermId) {
      toast.error('Please select class and academic term');
      return;
    }
    try {
      await clonePlan({ id, dto: cloneData });
      toast.success('Lesson plan cloned successfully');
      setCloneOpen(false);
      // Typically router.push to the new plan or list
      router.push('/academics/lesson-plans');
    } catch (e) {
      toast.error('Failed to clone lesson plan');
    }
  };

  if (isLoading || !plan) {
    return <div className="p-8 space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-32 w-full" />
    </div>;
  }

  const title = plan.planType === 'WEEKLY' 
    ? `Week ${plan.weekNumber} - ${plan.course.name} - ${plan.class.name}`
    : `Month ${plan.month} - ${plan.course.name} - ${plan.class.name}`;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/academics/lesson-plans')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">
            {format(new Date(plan.startDate), 'MMM d, yyyy')} - {format(new Date(plan.endDate), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <LessonPlanStatusBadge status={plan.status} version={plan.version} className="text-sm px-3 py-1" />
        </div>
      </div>

      {plan.status === 'REVISION_REQUESTED' && plan.generalRemarks && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
          <AlertTitle className="font-semibold">Revision Requested</AlertTitle>
          <AlertDescription className="mt-1">
            <strong>HoD Remarks:</strong> {plan.generalRemarks}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Topics & Activities</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/4">Topic</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Methodology</TableHead>
                  <TableHead className="w-1/4">Resources & Outcomes</TableHead>
                  {plan.status === 'REVISION_REQUESTED' && <TableHead className="w-1/4">Feedback</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium align-top">
                      {item.syllabusTopic?.title || 'Unknown Topic'}
                    </TableCell>
                    <TableCell className="align-top">{item.estimatedHours}</TableCell>
                    <TableCell className="align-top">{item.methodology}</TableCell>
                    <TableCell className="align-top">
                      <div className="text-sm mb-2">
                        <strong>Resources:</strong> <span className="text-muted-foreground">{item.resources || 'None'}</span>
                      </div>
                      <div className="text-sm">
                        <strong>Outcomes:</strong> <span className="text-muted-foreground">{item.learningOutcomes || 'None'}</span>
                      </div>
                    </TableCell>
                    {plan.status === 'REVISION_REQUESTED' && (
                      <TableCell className="align-top">
                        {item.hodComment ? (
                          <span className="text-red-600 text-sm font-medium">{item.hodComment}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">No specific feedback</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Plan Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <span className="text-muted-foreground block mb-1">Class</span>
                <span className="font-medium">{plan.class.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Course</span>
                <span className="font-medium">{plan.course.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Academic Term</span>
                <span className="font-medium">{plan.academicTerm.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Creator</span>
                <span className="font-medium">{plan.creator.user.firstName} {plan.creator.user.lastName}</span>
              </div>
              {plan.submittedAt && (
                <div>
                  <span className="text-muted-foreground block mb-1">Submitted</span>
                  <span className="font-medium">{format(new Date(plan.submittedAt), 'MMM d, yyyy h:mm a')}</span>
                </div>
              )}
              {plan.reviewer && (
                <div>
                  <span className="text-muted-foreground block mb-1">Reviewed By</span>
                  <span className="font-medium">{plan.reviewer.user.firstName} {plan.reviewer.user.lastName}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {plan.status === 'DRAFT' && canCreate && (
                <>
                  <Button className="w-full justify-start" variant="outline" onClick={() => router.push(`/academics/lesson-plans/${plan.id}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" /> Edit Plan
                  </Button>
                  <Button className="w-full justify-start" disabled={isSubmitting} onClick={handleSubmit}>
                    <Send className="mr-2 h-4 w-4" /> Submit for Review
                  </Button>
                </>
              )}

              {plan.status === 'REVISION_REQUESTED' && canCreate && (
                <>
                  <Button className="w-full justify-start" variant="outline" onClick={() => router.push(`/academics/lesson-plans/${plan.id}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" /> Edit Plan
                  </Button>
                  <Button className="w-full justify-start" disabled={isResubmitting} onClick={handleResubmit}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Resubmit Plan
                  </Button>
                </>
              )}

              {plan.status === 'APPROVED' && canCreate && (
                <Button className="w-full justify-start" variant="outline" onClick={() => setCloneOpen(true)}>
                  <Copy className="mr-2 h-4 w-4" /> Clone Plan
                </Button>
              )}

              <div title="Coming soon - Work Diary module under development">
                <Button className="w-full justify-start" variant="secondary" disabled>
                  <BookOpen className="mr-2 h-4 w-4" /> Log to Work Diary
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {(plan.parentVersion || plan.childVersions?.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Version History</CardTitle>
            <CardDescription>View previous iterations of this plan.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {plan.parentVersion && (
                <Button variant="outline" onClick={() => router.push(`/academics/lesson-plans/${plan.parentVersion!.id}`)}>
                  View Previous (v{plan.parentVersion.version})
                </Button>
              )}
              {plan.childVersions?.map(cv => (
                <Button key={cv.id} variant="outline" onClick={() => router.push(`/academics/lesson-plans/${cv.id}`)}>
                  View Newer (v{cv.version})
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Lesson Plan</DialogTitle>
            <DialogDescription>
              Create a copy of this approved plan for another class or term.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Target Class</Label>
              <Select value={cloneData.classId} onValueChange={v => setCloneData({...cloneData, classId: v})}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Academic Term</Label>
              <Select value={cloneData.academicTermId} onValueChange={v => setCloneData({...cloneData, academicTermId: v})}>
                <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                <SelectContent>
                  {terms?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea 
                placeholder="Any modifications needed?" 
                value={cloneData.note} 
                onChange={e => setCloneData({...cloneData, note: e.target.value})} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneOpen(false)}>Cancel</Button>
            <Button onClick={handleClone} disabled={isCloning}>Clone Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LessonPlanDetail;
