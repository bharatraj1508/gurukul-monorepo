'use client';

import * as React from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useRequirePermission } from '@/hooks/use-require-permission';
import { cn } from '@/lib/utils';
import {
  CalendarClock,
  Clock,
  DoorOpen,
  LayoutGrid,
  Repeat2,
  UserCog,
} from 'lucide-react';

import { PERMS } from '@repo/permissions';

interface SetupTab {
  segment: string;
  label: string;
  icon: React.ElementType;
}

const SETUP_TABS: SetupTab[] = [
  { segment: 'rooms', label: 'Rooms', icon: DoorOpen },
  { segment: 'periods', label: 'Periods', icon: Clock },
  { segment: 'allocations', label: 'Allocations', icon: LayoutGrid },
  { segment: 'constraints', label: 'Constraints', icon: UserCog },
  { segment: 'substitutions', label: 'Substitutions', icon: Repeat2 },
];

const BASE_PATH = '/academics/timetable/setup';

export default function TimetableSetupLayoutContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  const allowed = useRequirePermission({ permission: PERMS.timetable.manage });
  const pathname = usePathname();
  const activeSegment = pathname.split('/').pop() || 'rooms';

  if (!allowed) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
          <CalendarClock className="h-6 w-6 text-primary" />
          Timetable Setup
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure rooms, periods, allocations, and constraints before
          generating a timetable.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 hide-scrollbar">
        <div className="flex space-x-1 border-b border-zinc-200 dark:border-zinc-800 w-full">
          {SETUP_TABS.map((tab) => {
            const isActive = activeSegment === tab.segment;
            return (
              <Link
                key={tab.segment}
                href={`${BASE_PATH}/${tab.segment}`}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="pt-2">{children}</div>
    </div>
  );
}
