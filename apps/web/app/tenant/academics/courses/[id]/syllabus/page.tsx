import SyllabusManagerContainer from '@/containers/Tenant/Courses/SyllabusManager';

export const metadata = {
  title: 'Syllabus Topics',
  description: 'Manage topic and sub-topic structure for this course.',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CoursesSyllabusPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <SyllabusManagerContainer courseId={id} />
    </div>
  );
}
