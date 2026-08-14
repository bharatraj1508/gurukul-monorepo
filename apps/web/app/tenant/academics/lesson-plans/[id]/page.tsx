import LessonPlanDetailContainer from '@/containers/Tenant/LessonPlans/LessonPlanDetail';

export const metadata = {
  title: 'Lesson Plan Details',
  description: 'View and manage your lesson plan.',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LessonPlanDetailPage({ params }: Props) {
  const { id } = await params;
  return <LessonPlanDetailContainer id={id} />;
}
