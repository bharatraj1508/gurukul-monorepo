'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { ISO_DAY_SHORT, templatePeriodNumbers } from '@/lib/timetable';
import { cn } from '@/lib/utils';
import { useTeachers } from '@/services/api/requests/teachers';
import {
  type TeacherConstraint,
  useDeleteTeacherConstraint,
  usePeriodTemplates,
  useSaveTeacherConstraint,
  useTeacherConstraints,
} from '@/services/api/requests/timetable-config';
import { RotateCcw, Save, UserCog } from 'lucide-react';
import { toast } from 'sonner';

interface DraftConstraint {
  maxPeriodsPerDay: string;
  maxPeriodsPerWeek: string;
  maxConsecutivePeriods: string;
  /** Fully-available baseline uses null; a Set marks explicit availability. */
  availability: Record<number, Set<number>> | null;
}

function toDraft(constraint: TeacherConstraint | undefined): DraftConstraint {
  const availability = constraint?.availability
    ? Object.fromEntries(
        Object.entries(constraint.availability).map(([day, periods]) => [
          Number(day),
          new Set(periods),
        ]),
      )
    : null;
  return {
    maxPeriodsPerDay: constraint?.maxPeriodsPerDay?.toString() ?? '',
    maxPeriodsPerWeek: constraint?.maxPeriodsPerWeek?.toString() ?? '',
    maxConsecutivePeriods: constraint?.maxConsecutivePeriods?.toString() ?? '',
    availability,
  };
}

function parseLimit(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const num = Number.parseInt(trimmed, 10);
  return Number.isNaN(num) ? null : num;
}

export default function TeacherConstraintsContainer() {
  const { data: teachersData, isLoading: isLoadingTeachers } = useTeachers({
    limit: 200,
  });
  const { data: constraints } = useTeacherConstraints();
  const { data: templates } = usePeriodTemplates();
  const { mutateAsync: saveConstraint, isPending: isSaving } =
    useSaveTeacherConstraint();
  const { mutateAsync: deleteConstraint, isPending: isDeleting } =
    useDeleteTeacherConstraint();

  const [teacherId, setTeacherId] = useState('');

  const teacherOptions = useMemo(
    () =>
      (teachersData?.teachers ?? []).map((t) => ({
        value: t.id,
        label: t.name,
        description: t.email,
      })),
    [teachersData],
  );

  const constraintByTeacher = useMemo(
    () => new Map((constraints ?? []).map((c) => [c.tenantMembershipId, c])),
    [constraints],
  );

  // Working period numbers + days come from the largest template (superset).
  const { periodNumbers, workingDays } = useMemo(() => {
    let periods: number[] = [];
    let days: number[] = [];
    for (const template of templates ?? []) {
      const p = templatePeriodNumbers(template.slots);
      if (p.length > periods.length) periods = p;
      if (template.workingDays.length > days.length)
        days = [...template.workingDays].sort((a, b) => a - b);
    }
    return { periodNumbers: periods, workingDays: days };
  }, [templates]);

  const [draft, setDraft] = useState<DraftConstraint>(() => toDraft(undefined));

  useEffect(() => {
    if (!teacherId) return;
    setDraft(toDraft(constraintByTeacher.get(teacherId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, constraints]);

  const isAvailable = (day: number, period: number) => {
    if (draft.availability === null) return true;
    return draft.availability[day]?.has(period) ?? false;
  };

  const toggleCell = (day: number, period: number) => {
    setDraft((prev) => {
      // Materialise the fully-available baseline into explicit sets on first edit.
      const base: Record<number, Set<number>> = prev.availability === null
        ? Object.fromEntries(
            workingDays.map((d) => [d, new Set(periodNumbers)]),
          )
        : Object.fromEntries(
            Object.entries(prev.availability).map(([d, set]) => [
              Number(d),
              new Set(set),
            ]),
          );
      const set = base[day] ?? new Set<number>();
      if (set.has(period)) set.delete(period);
      else set.add(period);
      base[day] = set;
      return { ...prev, availability: base };
    });
  };

  const resetAvailability = () => {
    setDraft((prev) => ({ ...prev, availability: null }));
  };

  const handleSave = async () => {
    if (!teacherId) return;
    const availability =
      draft.availability === null
        ? null
        : Object.fromEntries(
            Object.entries(draft.availability).map(([day, set]) => [
              day,
              [...set].sort((a, b) => a - b),
            ]),
          );

    try {
      await saveConstraint({
        tenantMembershipId: teacherId,
        dto: {
          maxPeriodsPerDay: parseLimit(draft.maxPeriodsPerDay),
          maxPeriodsPerWeek: parseLimit(draft.maxPeriodsPerWeek),
          maxConsecutivePeriods: parseLimit(draft.maxConsecutivePeriods),
          availability,
        },
      });
      toast.success('Constraints saved.');
    } catch {
      toast.error('Could not save constraints. Please try again.');
    }
  };

  const handleClear = async () => {
    if (!teacherId) return;
    try {
      await deleteConstraint(teacherId);
      setDraft(toDraft(undefined));
      toast.success('Constraints cleared — teacher is fully available.');
    } catch {
      toast.error('Could not clear constraints. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Teacher Constraints
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Workload limits and availability the solver must respect.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Teacher
        </span>
        <div className="w-72">
          <SearchableSelect
            options={teacherOptions}
            value={teacherId}
            onChange={(value: string) => setTeacherId(value)}
            placeholder={
              isLoadingTeachers ? 'Loading teachers…' : '-- Select a teacher --'
            }
            disabled={isLoadingTeachers}
          />
        </div>
      </div>

      {!teacherId ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-3">
            <UserCog className="h-7 w-7 text-primary opacity-80" />
          </div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
            Pick a teacher
          </h3>
          <p className="text-zinc-500 max-w-sm text-sm">
            Choose a teacher above to set their workload limits and weekly
            availability.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Workload limits */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-3">
              Workload limits
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <LimitField
                label="Max periods / day"
                value={draft.maxPeriodsPerDay}
                disabled={isSaving}
                onChange={(v) =>
                  setDraft((prev) => ({ ...prev, maxPeriodsPerDay: v }))
                }
              />
              <LimitField
                label="Max periods / week"
                value={draft.maxPeriodsPerWeek}
                disabled={isSaving}
                onChange={(v) =>
                  setDraft((prev) => ({ ...prev, maxPeriodsPerWeek: v }))
                }
              />
              <LimitField
                label="Max consecutive"
                value={draft.maxConsecutivePeriods}
                disabled={isSaving}
                onChange={(v) =>
                  setDraft((prev) => ({ ...prev, maxConsecutivePeriods: v }))
                }
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Leave a field blank for no limit.
            </p>
          </div>

          {/* Availability grid */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                Availability
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={resetAvailability}
                disabled={isSaving || draft.availability === null}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Mark fully available
              </Button>
            </div>

            {periodNumbers.length === 0 || workingDays.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Create a period template first to set availability.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="border-collapse">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" />
                      {periodNumbers.map((period) => (
                        <th
                          key={period}
                          className="px-1.5 py-1 text-center text-[9px] font-medium text-muted-foreground"
                        >
                          P{period}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {workingDays.map((day) => (
                      <tr key={day}>
                        <td className="px-2 py-1 text-xs font-medium text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                          {ISO_DAY_SHORT[day]}
                        </td>
                        {periodNumbers.map((period) => {
                          const available = isAvailable(day, period);
                          return (
                            <td key={period} className="p-0.5">
                              <button
                                type="button"
                                onClick={() => toggleCell(day, period)}
                                disabled={isSaving}
                                title={`${ISO_DAY_SHORT[day]} P${period}`}
                                className={cn(
                                  'h-7 w-9 rounded-md border text-[10px] font-medium transition-colors',
                                  available
                                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                    : 'border-zinc-200 dark:border-zinc-800 bg-muted/30 text-muted-foreground',
                                )}
                              >
                                {available ? '✓' : '—'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">
              Green cells are periods the teacher can be scheduled. Fully
              available (all green) is stored as no restriction.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              className="gap-2 text-red-600 dark:text-red-400"
              onClick={handleClear}
              disabled={
                isSaving || isDeleting || !constraintByTeacher.has(teacherId)
              }
            >
              Clear constraints
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving…' : 'Save Constraints'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LimitField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-medium text-muted-foreground">
        {label}
      </label>
      <Input
        type="number"
        min={0}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="No limit"
        className="h-9"
      />
    </div>
  );
}
