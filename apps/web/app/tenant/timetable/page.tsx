import { Suspense } from 'react';

import type { Metadata } from 'next';

import TenantTimetableContainer from '@/containers/Tenant/Timetable';

export const metadata: Metadata = {
  title: 'My Timetable | Gurukul',
  description: 'Your daily schedule, weekly grid, and substitutions.',
};

export default function TimetablePage() {
  // The parent persona container reads useSearchParams (child selector), so a
  // Suspense boundary is required for the client render.
  return (
    <Suspense fallback={null}>
      <TenantTimetableContainer />
    </Suspense>
  );
}
