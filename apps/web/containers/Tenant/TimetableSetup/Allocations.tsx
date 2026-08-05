'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { templatePeriodNumbers } from '@/lib/timetable';
import { cn } from '@/lib/utils';
import { useAcademicTerms } from '@/services/api/requests/academic-terms';
import { useClass, useClasses } from '@/services/api/requests/classes';
import {
  ROOM_TYPES,
  ROOM_TYPE_LABELS,
  type RoomType,
  useRooms,
} from '@/services/api/requests/rooms';
import {
  type CourseAllocationInput,
  useCourseAllocations,
  usePeriodTemplates,
  useSaveCourseAllocations,
} from '@/services/api/requests/timetable-config';
import { LayoutGrid, Minus, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';

interface AllocationRow {
  courseId: string;
  courseName: string;
  periodsPerWeek: number;
  consecutiveBlockSize: number;
  roomType: RoomType | '';
  roomId: string;
}

const ROOM_TYPE_OPTIONS = [
  { value: '', label: 'Home classroom' },
  ...ROOM_TYPES.map((type) => ({ value: type, label: ROOM_TYPE_LABELS[type] })),
];

export default function AllocationsContainer() {
  const { data: terms } = useAcademicTerms();
  const activeTerm = useMemo(() => terms?.find((t) => t.isActive), [terms]);
  const { data: classes, isLoading: isLoadingClasses } = useClasses(
    activeTerm ? { term: activeTerm.id } : undefined,
  );

  const [classId, setClassId] = useState('');
  const { data: classDetail } = useClass(classId, !!classId);
  const { data: allocations, isLoading: isLoadingAllocations } =
    useCourseAllocations(classId, !!classId);
  const { data: rooms } = useRooms();
  const { data: templates } = usePeriodTemplates();
  const { mutateAsync: saveAllocations, isPending: isSaving } =
    useSaveCourseAllocations();

  const classOptions = useMemo(
    () => (classes ?? []).map((c) => ({ value: c.id, label: c.name })),
    [classes],
  );

  const courses = classDetail?.program?.courses ?? [];

  const [rows, setRows] = useState<AllocationRow[]>([]);

  // Seed the editable rows from the class's courses, merging in any saved
  // allocation. Re-runs whenever the class or its saved data changes.
  useEffect(() => {
    if (!classId || courses.length === 0) {
      setRows([]);
      return;
    }
    const byCourse = new Map((allocations ?? []).map((a) => [a.courseId, a]));
    setRows(
      courses.map((course) => {
        const saved = byCourse.get(course.id);
        return {
          courseId: course.id,
          courseName: course.name,
          periodsPerWeek: saved?.periodsPerWeek ?? 0,
          consecutiveBlockSize: saved?.consecutiveBlockSize ?? 1,
          roomType: saved?.roomType ?? '',
          roomId: saved?.roomId ?? '',
        };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, classDetail?.id, allocations]);

  const updateRow = (index: number, patch: Partial<AllocationRow>) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  // Grid capacity: periods per day × working days from the largest template.
  const gridCapacity = useMemo(() => {
    if (!templates || templates.length === 0) return null;
    let best = 0;
    for (const template of templates) {
      const periods = templatePeriodNumbers(template.slots).length;
      best = Math.max(best, periods * template.workingDays.length);
    }
    return best || null;
  }, [templates]);

  const totalPeriods = rows.reduce((sum, row) => sum + row.periodsPerWeek, 0);
  const overCapacity = gridCapacity != null && totalPeriods > gridCapacity;

  const roomOptions = useMemo(
    () => [
      { value: '', label: 'Any suitable room' },
      ...(rooms ?? []).map((room) => ({
        value: room.id,
        label: `${room.name} (${ROOM_TYPE_LABELS[room.type]})`,
      })),
    ],
    [rooms],
  );

  const handleSave = async () => {
    const payload: CourseAllocationInput[] = rows
      .filter((row) => row.periodsPerWeek > 0)
      .map((row) => ({
        courseId: row.courseId,
        periodsPerWeek: row.periodsPerWeek,
        consecutiveBlockSize: row.consecutiveBlockSize,
        // A pinned room takes precedence; otherwise fall back to a room type.
        roomId: row.roomId || null,
        roomType: row.roomId ? null : row.roomType || null,
      }));

    try {
      await saveAllocations({ classId, allocations: payload });
      toast.success('Allocations saved.');
    } catch {
      toast.error('Could not save allocations. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Subject Allocations
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            How many periods per week each subject gets, and which room it
            needs.
          </p>
        </div>
      </div>

      {/* Class picker */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Class
        </span>
        <div className="w-72">
          <SearchableSelect
            options={classOptions}
            value={classId}
            onChange={(value: string) => setClassId(value)}
            placeholder={
              isLoadingClasses ? 'Loading classes…' : '-- Select a class --'
            }
            disabled={isLoadingClasses}
          />
        </div>
      </div>

      {!classId ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-3">
            <LayoutGrid className="h-7 w-7 text-primary opacity-80" />
          </div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
            Pick a class to allocate
          </h3>
          <p className="text-zinc-500 max-w-sm text-sm">
            Choose a class above to set the weekly period count for each of its
            subjects.
          </p>
        </div>
      ) : isLoadingAllocations ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 animate-pulse"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
            No subjects on this class
          </h3>
          <p className="text-zinc-500 max-w-sm text-sm">
            This class&apos;s program has no courses to allocate.
          </p>
        </div>
      ) : (
        <>
          {/* Capacity meter */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-card p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                Weekly periods allocated
              </span>
              <span
                className={cn(
                  'font-mono font-medium',
                  overCapacity
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-muted-foreground',
                )}
              >
                {totalPeriods}
                {gridCapacity != null ? ` / ${gridCapacity}` : ''}
              </span>
            </div>
            {gridCapacity != null && (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    overCapacity ? 'bg-red-500' : 'bg-primary',
                  )}
                  style={{
                    width: `${Math.min(100, (totalPeriods / gridCapacity) * 100)}%`,
                  }}
                />
              </div>
            )}
            {overCapacity && (
              <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">
                Allocations exceed the weekly grid capacity — reduce some
                subjects before generating.
              </p>
            )}
          </div>

          {/* Allocation rows */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="hidden sm:grid grid-cols-[1fr_120px_120px_1fr_1fr] gap-3 bg-zinc-50 dark:bg-zinc-900/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Subject</span>
              <span>Periods/wk</span>
              <span>Block size</span>
              <span>Room type</span>
              <span>Pinned room</span>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {rows.map((row, index) => (
                <div
                  key={row.courseId}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_1fr_1fr] gap-3 px-4 py-3 items-center"
                >
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {row.courseName}
                  </span>

                  <Stepper
                    value={row.periodsPerWeek}
                    min={0}
                    disabled={isSaving}
                    onChange={(v) => updateRow(index, { periodsPerWeek: v })}
                  />

                  <Stepper
                    value={row.consecutiveBlockSize}
                    min={1}
                    disabled={isSaving}
                    onChange={(v) =>
                      updateRow(index, { consecutiveBlockSize: v })
                    }
                  />

                  <SearchableSelect
                    options={ROOM_TYPE_OPTIONS}
                    value={row.roomType}
                    onChange={(value: string) =>
                      updateRow(index, {
                        roomType: value as RoomType | '',
                        roomId: '',
                      })
                    }
                    placeholder="Home classroom"
                    disabled={isSaving || !!row.roomId}
                  />

                  <SearchableSelect
                    options={roomOptions}
                    value={row.roomId}
                    onChange={(value: string) =>
                      updateRow(index, { roomId: value })
                    }
                    placeholder="Any suitable room"
                    disabled={isSaving}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving…' : 'Save Allocations'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Stepper({
  value,
  min,
  disabled,
  onChange,
}: {
  value: number;
  min: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <Input
        type="number"
        min={min}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = Number.parseInt(e.target.value, 10);
          onChange(Number.isNaN(next) ? min : Math.max(min, next));
        }}
        className="h-8 w-14 text-center"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        disabled={disabled}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
