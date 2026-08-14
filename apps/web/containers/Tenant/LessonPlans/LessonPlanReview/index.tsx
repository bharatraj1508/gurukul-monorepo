'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Check, X, FileText, Clock, AlertCircle, ArrowLeft } from 'lucide-react';

import { 
  useLessonPlans, 
  useReviewSummary, 
  useApproveLessonPlan, 
  useRequestRevision,
  LessonPlan 
} from '@/services/api/requests/lesson-plans';
import { usePermission } from '@/hooks/use-permission';
import { PERMS } from '@repo/permissions';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export function LessonPlanReview() {
  const router = useRouter();
  const { hasPermission } = usePermission();
  const canApprove = hasPermission(PERMS.lessonPlan.approve);
  
  const { data: summary, isLoading: isLoadingSummary } = useReviewSummary();
  const { data: submittedPlans, isLoading: isLoadingPlans } = useLessonPlans({ status: 'SUBMITTED' });
  
  const { mutateAsync: approvePlan, isPending: isApproving } = useApproveLessonPlan();
  const { mutateAsync: requestRevision, isPending: isRequesting } = useRequestRevision();

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [generalRemarks, setGeneralRemarks] = useState('');
  const [topicComments, setTopicComments] = useState<Record<string, string>>({});

  // Redirect if no permission (in real app might use a layout or HOC, but doing it simply here)
  if (!canApprove) {
    if (typeof window !== 'undefined') {
      router.push('/academics/lesson-plans');
    }
    return null;
  }

  const selectedPlan = submittedPlans?.find(p => p.id === selectedPlanId);

  // Group plans by teacher
  const groupedPlans = submittedPlans?.reduce((acc, plan) => {
    const teacherName = `${plan.creator.user.firstName} ${plan.creator.user.lastName}`;
    if (!acc[teacherName]) acc[teacherName] = [];
    acc[teacherName].push(plan);
    return acc;
  }, {} as Record<string, LessonPlan[]>) || {};

  const handleTopicCommentChange = (itemId: string, val: string) => {
    setTopicComments(prev => ({ ...prev, [itemId]: val }));
  };

  const handleApprove = async () => {
    if (!selectedPlanId) return;
    try {
      const dto = { generalRemarks: generalRemarks || undefined };
      await approvePlan({ id: selectedPlanId, dto });
      toast.success('Lesson plan approved');
      setSelectedPlanId(null);
      setGeneralRemarks('');
      setTopicComments({});
    } catch (e) {
      toast.error('Failed to approve lesson plan');
    }
  };

  const handleRequestRevision = async () => {
    if (!selectedPlanId) return;
    try {
      const commentsArray = Object.entries(topicComments)
        .filter(([_, comment]) => comment.trim() !== '')
        .map(([itemId, comment]) => ({ itemId, comment }));

      if (!generalRemarks && commentsArray.length === 0) {
        toast.error('Please provide some remarks or comments for the revision');
        return;
      }

      await requestRevision({ 
        id: selectedPlanId, 
        dto: { generalRemarks, topicComments: commentsArray } 
      });
      toast.success('Revision requested');
      setSelectedPlanId(null);
      setGeneralRemarks('');
      setTopicComments({});
    } catch (e) {
      toast.error('Failed to request revision');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/academics/lesson-plans')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review Queue</h1>
          <p className="text-muted-foreground">Review and approve submitted lesson plans.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-6 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <FileText className="h-4 w-4" /> Total Plans
            </div>
            <div className="text-3xl font-bold">{isLoadingSummary ? <Skeleton className="h-8 w-12" /> : summary?.total || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-amber-700 mb-2">
              <Clock className="h-4 w-4" /> Pending Review
            </div>
            <div className="text-3xl font-bold text-amber-900">{isLoadingSummary ? <Skeleton className="h-8 w-12" /> : summary?.submitted || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <Check className="h-4 w-4" /> Approved
            </div>
            <div className="text-3xl font-bold text-green-900">{isLoadingSummary ? <Skeleton className="h-8 w-12" /> : summary?.approved || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-6 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-red-700 mb-2">
              <AlertCircle className="h-4 w-4" /> Revision Requested
            </div>
            <div className="text-3xl font-bold text-red-900">{isLoadingSummary ? <Skeleton className="h-8 w-12" /> : summary?.revisionRequested || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 border rounded-lg overflow-hidden bg-background">
          <div className="p-4 bg-muted/50 border-b font-medium">
            Submitted Plans
          </div>
          <ScrollArea className="h-[600px]">
            {isLoadingPlans ? (
              <div className="p-4 space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : Object.keys(groupedPlans).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No plans pending review.
              </div>
            ) : (
              <div className="p-2 space-y-4">
                {Object.entries(groupedPlans).map(([teacher, plans]) => (
                  <div key={teacher} className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground px-2 pt-2">{teacher}</h4>
                    {plans.map(plan => (
                      <div 
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`p-3 rounded-md cursor-pointer border transition-colors ${
                          selectedPlanId === plan.id 
                            ? 'bg-primary/5 border-primary shadow-sm' 
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="font-medium text-sm">
                          {plan.class.name} - {plan.course.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex justify-between">
                          <span>{plan.planType === 'WEEKLY' ? `Week ${plan.weekNumber}` : `Month ${plan.month}`}</span>
                          <span>{format(new Date(plan.submittedAt!), 'MMM d')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="lg:col-span-2">
          {selectedPlan ? (
            <Card className="h-full flex flex-col">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl mb-1">
                      {selectedPlan.class.name} - {selectedPlan.course.name}
                    </CardTitle>
                    <CardDescription>
                      {selectedPlan.planType === 'WEEKLY' ? `Week ${selectedPlan.weekNumber}` : `Month ${selectedPlan.month}`} • 
                      Submitted by {selectedPlan.creator.user.firstName} {selectedPlan.creator.user.lastName} on {format(new Date(selectedPlan.submittedAt!), 'MMM d, yyyy')}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">v{selectedPlan.version}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-0">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0">
                    <TableRow>
                      <TableHead className="w-1/3">Topic & Details</TableHead>
                      <TableHead>Methodology</TableHead>
                      <TableHead className="w-1/3">HoD Feedback</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPlan.items.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="align-top">
                          <div className="font-medium">{item.syllabusTopic.title}</div>
                          <div className="text-xs text-muted-foreground mt-1">{item.estimatedHours} Hours</div>
                          {item.resources && (
                            <div className="text-xs mt-2"><span className="font-medium">Resources:</span> {item.resources}</div>
                          )}
                          {item.learningOutcomes && (
                            <div className="text-xs mt-1"><span className="font-medium">Outcomes:</span> {item.learningOutcomes}</div>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          {item.methodology}
                        </TableCell>
                        <TableCell className="align-top">
                          <Input 
                            placeholder="Add specific comment..." 
                            value={topicComments[item.id] || ''}
                            onChange={(e) => handleTopicCommentChange(item.id, e.target.value)}
                            className="text-sm h-8"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                <div className="p-4 border-t space-y-3">
                  <h4 className="font-medium text-sm">General Remarks</h4>
                  <Textarea 
                    placeholder="Provide overall feedback or approval notes..." 
                    value={generalRemarks}
                    onChange={(e) => setGeneralRemarks(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
              <div className="p-4 border-t flex justify-end gap-3 bg-muted/20">
                <Button 
                  variant="destructive" 
                  disabled={isApproving || isRequesting}
                  onClick={handleRequestRevision}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <X className="w-4 h-4 mr-2" /> Request Revision
                </Button>
                <Button 
                  disabled={isApproving || isRequesting}
                  onClick={handleApprove}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="w-4 h-4 mr-2" /> Approve Plan
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center border-dashed">
              <div className="text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Select a lesson plan from the queue to review</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default LessonPlanReview;
