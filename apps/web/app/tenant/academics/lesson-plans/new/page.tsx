import LessonPlanBuilderContainer from '@/containers/Tenant/LessonPlans/LessonPlanBuilder';

export const metadata = {
  title: 'Create Lesson Plan',
  description: 'Build a new weekly or monthly lesson plan from your syllabus.',
};

export default function NewLessonPlanPage() {
  return <LessonPlanBuilderContainer existingPlan={null} />;
}
