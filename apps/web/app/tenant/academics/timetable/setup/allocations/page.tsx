import type { Metadata } from 'next';

import AllocationsContainer from '@/containers/Tenant/TimetableSetup/Allocations';

export const metadata: Metadata = {
  title: 'Allocations · Timetable Setup | Gurukul',
  description: 'Set how many periods each subject gets per class.',
};

export default AllocationsContainer;
