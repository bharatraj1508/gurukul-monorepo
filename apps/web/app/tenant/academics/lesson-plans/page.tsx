import LessonPlanListContainer from '@/containers/Tenant/LessonPlans/LessonPlanList';

export const metadata = {
  title: 'Lesson Plans',
  description: 'Create and manage your weekly and monthly lesson plans.',
};

export default function LessonPlansPage() {
  return <LessonPlanListContainer />;
}
