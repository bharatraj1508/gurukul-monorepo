'use client';

import { useMemo, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { ChildSwitcher } from '@/components/timetable/ChildSwitcher';
import { useRequirePermission } from '@/hooks/use-require-permission';
import { getWeekStartISO, resolveNow } from '@/lib/timetable';
import { cn } from '@/lib/utils';
import {
  useMyTeacherTimetable,
  useMyTimetable,
  useStudentTimetable,
  useViewerContext,
} from '@/services/api/requests/timetables';
import { CalendarClock, Users } from 'lucide-react';

import { PERMS } from '@repo/permissions';

import { PersonaTimetable } from './PersonaTimetable';

type PersonaKey = 'student' | 'teacher' | 'parent';

const PERSONA_LABELS: Record<PersonaKey, string> = {
  student: 'My Classes',
  teacher: 'My Teaching',
  parent: 'My Children',
};

export default function TenantTimetableContainer() {
  const allowed = useRequirePermission({
    permission: PERMS.timetable.viewOwn,
  });

  const { data: context, isLoading: isLoadingContext } = useViewerContext();

  // Persona order is fixed: student > teacher > parent.
  const personas = useMemo<PersonaKey[]>(() => {
    if (!context) return [];
    const list: PersonaKey[] = [];
    if (context.personas.isStudent) list.push('student');
    if (context.personas.isTeacher) list.push('teacher');
    if (context.personas.isParent) list.push('parent');
    return list;
  }, [context]);

  const [personaOverride, setPersonaOverride] = useState<PersonaKey | null>(
    null,
  );
  const activePersona: PersonaKey | null =
    personaOverride && personas.includes(personaOverride)
      ? personaOverride
      : (personas[0] ?? null);

  const [weekStart, setWeekStart] = useState(() =>
    getWeekStartISO(resolveNow()),
  );

  if (!allowed) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-primary" />
            My Timetable
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your daily schedule, weekly grid, and substitutions.
          </p>
        </div>
      </div>

      {/* Persona tabs when the member wears multiple hats */}
      {personas.length > 1 && (
        <div className="flex space-x-1 border-b border-zinc-200 dark:border-zinc-800">
          {personas.map((persona) => (
            <button
              key={persona}
              type="button"
              onClick={() => setPersonaOverride(persona)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap cursor-pointer',
                activePersona === persona
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {PERSONA_LABELS[persona]}
            </button>
          ))}
        </div>
      )}

      {isLoadingContext ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 animate-pulse"
            />
          ))}
        </div>
      ) : !activePersona ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-primary opacity-80" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
            No timetable to show
          </h3>
          <p className="text-zinc-500 max-w-sm">
            Your account isn&apos;t linked to a student, teacher, or parent
            profile yet. Ask your school administrator to link it.
          </p>
        </div>
      ) : activePersona === 'student' ? (
        <StudentPersona
          weekStart={weekStart}
          onWeekStartChange={setWeekStart}
        />
      ) : activePersona === 'teacher' ? (
        <TeacherPersona
          weekStart={weekStart}
          onWeekStartChange={setWeekStart}
        />
      ) : (
        <ParentPersona weekStart={weekStart} onWeekStartChange={setWeekStart} />
      )}
    </div>
  );
}

interface PersonaSectionProps {
  weekStart: string;
  onWeekStartChange: (weekStart: string) => void;
}

function StudentPersona({ weekStart, onWeekStartChange }: PersonaSectionProps) {
  const { data: view, isLoading } = useMyTimetable(weekStart);
  return (
    <PersonaTimetable
      view={view}
      isLoading={isLoading}
      weekStart={weekStart}
      onWeekStartChange={onWeekStartChange}
      printSubjectLabel="Student timetable"
      emptyTitle="No published timetable yet"
      emptySubtitle="Your class timetable will appear here as soon as the school publishes it."
    />
  );
}

function TeacherPersona({ weekStart, onWeekStartChange }: PersonaSectionProps) {
  const { data: view, isLoading } = useMyTeacherTimetable(weekStart);
  return (
    <PersonaTimetable
      view={view}
      isLoading={isLoading}
      weekStart={weekStart}
      onWeekStartChange={onWeekStartChange}
      printSubjectLabel="Teaching timetable"
      emptyTitle="No published timetable yet"
      emptySubtitle="Your teaching schedule will appear here as soon as the school publishes a timetable."
    />
  );
}

function ParentPersona({ weekStart, onWeekStartChange }: PersonaSectionProps) {
  const { data: context } = useViewerContext();
  const childProfiles = useMemo(() => context?.children ?? [], [context]);

  const router = useRouter();
  const searchParams = useSearchParams();
  const childParam = searchParams.get('child');

  const selectedChild =
    childProfiles.find((child) => child.studentProfileId === childParam) ??
    childProfiles[0] ??
    null;

  const selectChild = (studentProfileId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('child', studentProfileId);
    router.replace(`/timetable?${params.toString()}`, { scroll: false });
  };

  const { data: view, isLoading } = useStudentTimetable(
    selectedChild?.studentProfileId ?? '',
    weekStart,
    !!selectedChild,
  );

  if (childProfiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Users className="h-8 w-8 text-primary opacity-80" />
        </div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
          No linked children
        </h3>
        <p className="text-zinc-500 max-w-sm">
          Once the school links your children to your account, their timetables
          will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ChildSwitcher
        childProfiles={childProfiles}
        selectedId={selectedChild?.studentProfileId ?? null}
        onSelect={selectChild}
      />
      <PersonaTimetable
        key={selectedChild?.studentProfileId}
        view={view}
        isLoading={isLoading}
        weekStart={weekStart}
        onWeekStartChange={onWeekStartChange}
        printSubjectLabel={
          selectedChild
            ? `${selectedChild.name}${selectedChild.className ? ` · ${selectedChild.className}` : ''}`
            : 'Timetable'
        }
        emptyTitle="No published timetable yet"
        emptySubtitle={
          selectedChild
            ? `${selectedChild.name}'s timetable will appear here as soon as the school publishes it.`
            : 'The timetable will appear here as soon as the school publishes it.'
        }
      />
    </div>
  );
}
