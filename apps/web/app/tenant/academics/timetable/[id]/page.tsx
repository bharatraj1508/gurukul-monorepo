import type { Metadata } from 'next';

import TimetableEditorContainer from '@/containers/Tenant/TimetableStudio/Editor';

interface TimetableEditorPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const metadata: Metadata = {
  title: 'Timetable Editor | Gurukul',
  description: 'Review, adjust, and publish a draft timetable version.',
};

export default async function TimetableEditorPage({
  params,
}: TimetableEditorPageProps) {
  const { id } = await params;
  return <TimetableEditorContainer timetableId={id} />;
}
