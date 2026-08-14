'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

import { useCreateLessonPlan, useUpdateLessonPlan, LessonPlan, Methodology, CreateLessonPlanItemDto, PlanType } from '@/services/api/requests/lesson-plans';
import { useSyllabusTopics } from '@/services/api/requests/syllabus-topics';
import { useClasses } from '@/services/api/requests/classes';
import { useCourses } from '@/services/api/requests/courses';
import { useAcademicTerms } from '@/services/api/requests/academic-terms';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LessonPlanBuilderProps {
  existingPlan?: LessonPlan | null;
}

const METHODOLOGIES: Methodology[] = [
  'Lecture', 'Lab', 'Group Activity', 'Presentation', 'Discussion', 'Project', 'Demonstration', 'Field Trip', 'Self Study'
];

function generateTempId(): string {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'item-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
}

export function LessonPlanBuilder({ existingPlan }: LessonPlanBuilderProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  
  const { mutateAsync: createLessonPlan, isPending: isCreating } = useCreateLessonPlan();
  const { mutateAsync: updateLessonPlan, isPending: isUpdating } = useUpdateLessonPlan();
  const isPending = isCreating || isUpdating;
  
  const { data: classes } = useClasses();
  const { data: courses } = useCourses();
  const { data: terms } = useAcademicTerms();

  const startDateRef = React.useRef<HTMLInputElement>(null);
  const endDateRef = React.useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    classId: existingPlan?.classId || '',
    courseId: existingPlan?.courseId || '',
    academicTermId: existingPlan?.academicTermId || '',
    planType: existingPlan?.planType || 'WEEKLY' as PlanType,
    weekNumber: existingPlan?.weekNumber || 1,
    month: existingPlan?.month || 1,
    startDate: existingPlan?.startDate?.substring(0, 10) || '',
    endDate: existingPlan?.endDate?.substring(0, 10) || '',
  });

  useEffect(() => {
    if (terms && terms.length > 0 && !formData.academicTermId) {
      const activeTerm = terms.find((t) => t.isActive) || terms[0];
      if (activeTerm) {
        setFormData((prev) => ({ ...prev, academicTermId: activeTerm.id }));
      }
    }
  }, [terms, formData.academicTermId]);

  useEffect(() => {
    const firstClass = classes?.[0];
    if (firstClass && !formData.classId) {
      setFormData((prev) => ({ ...prev, classId: firstClass.id }));
    }
  }, [classes, formData.classId]);

  useEffect(() => {
    const firstCourse = courses?.[0];
    if (firstCourse && !formData.courseId) {
      setFormData((prev) => ({ ...prev, courseId: firstCourse.id }));
    }
  }, [courses, formData.courseId]);

  const { data: syllabusTopics } = useSyllabusTopics(formData.courseId, !!formData.courseId);

  const [items, setItems] = useState<Partial<CreateLessonPlanItemDto & { id: string; title: string; hodComment?: string | null }>[]>(
    existingPlan?.items.map(i => ({
      id: generateTempId(),
      syllabusTopicId: i.syllabusTopic.id,
      title: i.syllabusTopic.title,
      estimatedHours: i.estimatedHours,
      methodology: i.methodology,
      resources: i.resources || '',
      learningOutcomes: i.learningOutcomes || '',
      hodComment: i.hodComment || null,
    })) || []
  );

  const handleNext = () => {
    if (!formData.classId || !formData.courseId || !formData.academicTermId || !formData.startDate || !formData.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }
    setStep(2);
  };

  const addTopic = (topic: any) => {
    setItems([...items, {
      id: generateTempId(),
      syllabusTopicId: topic.id,
      title: topic.title,
      estimatedHours: 1,
      methodology: 'Lecture',
      resources: '',
      learningOutcomes: '',
    }]);
  };

  const removeTopic = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const moveTopic = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;
    
    const newItems = [...items];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const itemA = newItems[index];
    const itemB = newItems[newIndex];
    if (itemA && itemB) {
      newItems[index] = itemB;
      newItems[newIndex] = itemA;
      setItems(newItems);
    }
  };

  const updateTopic = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (submitImmediately: boolean) => {
    if (items.length === 0) {
      toast.error('Please add at least one topic');
      return;
    }

    try {
      const formattedItems = items.map((item, index) => ({
        syllabusTopicId: item.syllabusTopicId!,
        estimatedHours: Number(item.estimatedHours),
        methodology: item.methodology as Methodology,
        resources: item.resources,
        learningOutcomes: item.learningOutcomes,
        orderIndex: index,
      }));

      if (existingPlan) {
        await updateLessonPlan({
          id: existingPlan.id,
          dto: {
            startDate: formData.startDate,
            endDate: formData.endDate,
            weekNumber: formData.planType === 'WEEKLY' ? Number(formData.weekNumber) : undefined,
            month: formData.planType === 'MONTHLY' ? Number(formData.month) : undefined,
            items: formattedItems,
          },
        });
        toast.success('Lesson plan updated successfully');
      } else {
        const derivedYear = formData.startDate ? new Date(formData.startDate).getFullYear() : new Date().getFullYear();
        const payload = {
          ...formData,
          weekNumber: formData.planType === 'WEEKLY' ? Number(formData.weekNumber) : undefined,
          month: formData.planType === 'MONTHLY' ? Number(formData.month) : undefined,
          year: derivedYear,
          submitImmediately,
          items: formattedItems,
        };
        await createLessonPlan(payload);
        toast.success(`Lesson plan ${submitImmediately ? 'submitted' : 'saved as draft'}`);
      }
      router.push('/academics/lesson-plans');
    } catch (error) {
      toast.error('Failed to save lesson plan');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{existingPlan ? 'Edit Lesson Plan' : 'Create Lesson Plan'}</h1>
          <p className="text-muted-foreground mt-1">
            Step {step} of 2: {step === 1 ? 'Basic Information' : 'Topic Builder'}
          </p>
        </div>
      </div>

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={formData.classId || undefined} onValueChange={v => setFormData({ ...formData, classId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={formData.courseId || undefined} onValueChange={v => setFormData({ ...formData, courseId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                  <SelectContent>
                    {courses?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Academic Term</Label>
                <Select value={formData.academicTermId || undefined} onValueChange={v => setFormData({ ...formData, academicTermId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                  <SelectContent>
                    {terms?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <Label>Plan Type</Label>
              <RadioGroup 
                value={formData.planType} 
                onValueChange={(v: string) => setFormData({ ...formData, planType: v as PlanType })}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="WEEKLY" id="r1" />
                  <Label htmlFor="r1">Weekly</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="MONTHLY" id="r2" />
                  <Label htmlFor="r2">Monthly</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {formData.planType === 'WEEKLY' ? (
                <div className="space-y-2">
                  <Label>Week Number</Label>
                  <Input type="number" min={1} max={52} value={formData.weekNumber} onChange={e => setFormData({ ...formData, weekNumber: Number(e.target.value) })} />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Select value={String(formData.month)} onValueChange={v => setFormData({ ...formData, month: Number(v) })}>
                    <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {new Date(0, i).toLocaleString('default', { month: 'long' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Start Date</Label>
                <div
                  className="relative cursor-pointer"
                  onClick={() => startDateRef.current?.showPicker?.()}
                >
                  <Input
                    ref={startDateRef}
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>End Date</Label>
                <div
                  className="relative cursor-pointer"
                  onClick={() => endDateRef.current?.showPicker?.()}
                >
                  <Input
                    ref={endDateRef}
                    type="date"
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    className="cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end pt-6">
            <Button onClick={handleNext}>Next: Topic Builder</Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-1 h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">Available Topics</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-2">
              {!syllabusTopics?.length && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {formData.courseId ? 'No topics found for this course.' : 'Select a course in Step 1.'}
                </p>
              )}
              {syllabusTopics?.map(topic => (
                <div key={topic.id} className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50 text-sm">
                  <span className="truncate pr-2" title={topic.title}>{topic.title}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => addTopic(topic)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="lg:col-span-3 space-y-4">
            {items.length === 0 ? (
              <Card className="flex items-center justify-center h-64 border-dashed">
                <p className="text-muted-foreground">Click '+' on a topic to add it to this lesson plan.</p>
              </Card>
            ) : (
              items.map((item, index) => (
                <Card key={item.id} className="relative">
                  <CardContent className="p-4 pt-6 space-y-4">
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0} onClick={() => moveTopic(index, 'up')}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === items.length - 1} onClick={() => moveTopic(index, 'down')}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => removeTopic(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <h4 className="font-semibold text-lg pr-24">{item.title}</h4>

                    {item.hodComment && (
                      <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800 text-xs py-2">
                        <AlertTitle className="text-xs font-semibold flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> HoD Feedback:
                        </AlertTitle>
                        <AlertDescription className="mt-0.5 text-xs">{item.hodComment}</AlertDescription>
                      </Alert>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Estimated Hours</Label>
                        <Input type="number" min={0.5} step={0.5} value={item.estimatedHours} onChange={e => updateTopic(index, 'estimatedHours', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Methodology</Label>
                        <Select value={item.methodology} onValueChange={v => updateTopic(index, 'methodology', v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {METHODOLOGIES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Learning Outcomes</Label>
                      <Textarea value={item.learningOutcomes} onChange={e => updateTopic(index, 'learningOutcomes', e.target.value)} placeholder="What will students learn?" rows={2} />
                    </div>

                    <div className="space-y-2">
                      <Label>Resources / Materials</Label>
                      <Textarea value={item.resources} onChange={e => updateTopic(index, 'resources', e.target.value)} placeholder="e.g. Textbook Chapter 4, Projector, Handouts" rows={2} />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
            
            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <div className="space-x-2">
                <Button variant="secondary" disabled={isPending} onClick={() => handleSubmit(false)}>
                  Save as Draft
                </Button>
                <Button disabled={isPending || items.length === 0} onClick={() => handleSubmit(true)}>
                  Submit for Approval
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LessonPlanBuilder;
