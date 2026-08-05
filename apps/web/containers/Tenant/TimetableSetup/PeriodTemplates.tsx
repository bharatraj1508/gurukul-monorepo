'use client';

import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useShowDeleteModal } from '@/hooks/use-modal';
import { timeToMinutes } from '@/lib/timetable';
import { cn } from '@/lib/utils';
import {
  PERIOD_SLOT_KINDS,
  type PeriodSlotKind,
  type PeriodTemplate,
  useCreatePeriodTemplate,
  useDeletePeriodTemplate,
  usePeriodTemplates,
  useUpdatePeriodTemplate,
} from '@/services/api/requests/timetable-config';
import { zodResolver } from '@hookform/resolvers/zod';
import { Clock, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const KIND_LABELS: Record<PeriodSlotKind, string> = {
  PERIOD: 'Period',
  BREAK: 'Break',
  ASSEMBLY: 'Assembly',
  LUNCH: 'Lunch',
};

const ISO_WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

const slotSchema = z.object({
  kind: z.enum(['PERIOD', 'BREAK', 'ASSEMBLY', 'LUNCH']),
  label: z.string().trim().min(1, 'Label is required.').max(50),
  startTime: z.string().regex(HHMM, 'Use HH:mm.'),
  endTime: z.string().regex(HHMM, 'Use HH:mm.'),
});

const templateSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required.').max(100),
    workingDays: z.array(z.number()).min(1, 'Pick at least one working day.'),
    slots: z.array(slotSchema).min(1, 'Add at least one slot.'),
  })
  .superRefine((data, ctx) => {
    // Each slot's end must be after its start.
    data.slots.forEach((slot, index) => {
      if (
        HHMM.test(slot.startTime) &&
        HHMM.test(slot.endTime) &&
        timeToMinutes(slot.endTime) <= timeToMinutes(slot.startTime)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'End must be after start.',
          path: ['slots', index, 'endTime'],
        });
      }
    });

    // Slots must be ascending and non-overlapping in document order.
    for (let i = 1; i < data.slots.length; i++) {
      const prev = data.slots[i - 1];
      const curr = data.slots[i];
      if (
        prev &&
        curr &&
        HHMM.test(prev.endTime) &&
        HHMM.test(curr.startTime) &&
        timeToMinutes(curr.startTime) < timeToMinutes(prev.endTime)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Overlaps the previous slot.',
          path: ['slots', i, 'startTime'],
        });
      }
    }
  });

type TemplateValues = z.infer<typeof templateSchema>;

const EMPTY_TEMPLATE: TemplateValues = {
  name: '',
  workingDays: [1, 2, 3, 4, 5],
  slots: [
    { kind: 'PERIOD', label: 'Period 1', startTime: '08:00', endTime: '08:45' },
  ],
};

function toFormValues(template: PeriodTemplate): TemplateValues {
  return {
    name: template.name,
    workingDays: [...template.workingDays].sort((a, b) => a - b),
    slots: [...template.slots]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((slot) => ({
        kind: slot.kind,
        label: slot.label,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
  };
}

export default function PeriodTemplatesContainer() {
  const { data: templates, isLoading } = usePeriodTemplates();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const editingTemplate =
    editingId != null
      ? (templates?.find((t) => t.id === editingId) ?? null)
      : null;

  const showEditor = isCreating || editingId != null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Period Templates
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            The daily period structure — periods, breaks, and working days.
          </p>
        </div>
        {!showEditor && (
          <Button
            onClick={() => {
              setEditingId(null);
              setIsCreating(true);
            }}
            className="gap-2 shrink-0"
          >
            <Plus className="h-4 w-4" /> New Template
          </Button>
        )}
      </div>

      {showEditor ? (
        <TemplateEditor
          key={editingTemplate?.id ?? 'new'}
          template={editingTemplate}
          onDone={() => {
            setEditingId(null);
            setIsCreating(false);
          }}
        />
      ) : isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 animate-pulse"
            />
          ))}
        </div>
      ) : !templates?.length ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-3">
            <Clock className="h-7 w-7 text-primary opacity-80" />
          </div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
            No period templates yet
          </h3>
          <p className="text-zinc-500 max-w-sm mb-5 text-sm">
            Define how a school day is structured — periods, breaks, and which
            days the school runs.
          </p>
          <Button
            onClick={() => setIsCreating(true)}
            variant="outline"
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> New Template
          </Button>
        </div>
      ) : (
        <TemplateList templates={templates} onEdit={setEditingId} />
      )}
    </div>
  );
}

function TemplateList({
  templates,
  onEdit,
}: {
  templates: PeriodTemplate[];
  onEdit: (id: string) => void;
}) {
  const showDeleteModal = useShowDeleteModal();
  const { mutateAsync: deleteTemplate } = useDeletePeriodTemplate();

  const handleDelete = (template: PeriodTemplate) => {
    showDeleteModal({
      title: 'Delete this template?',
      subtitle: `“${template.name}” will be removed. Timetables generated from it are unaffected.`,
      confirmButtonText: 'Delete',
      onConfirm: async () => {
        try {
          await deleteTemplate(template.id);
          toast.success('Template deleted.');
        } catch {
          toast.error('Could not delete the template. Please try again.');
        }
      },
    });
  };

  return (
    <div className="space-y-2">
      {templates.map((template) => {
        const periodCount = template.slots.filter(
          (s) => s.kind === 'PERIOD',
        ).length;
        return (
          <div
            key={template.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-card px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">
                {template.name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {periodCount} period{periodCount === 1 ? '' : 's'} ·{' '}
                {template.slots.length} slot
                {template.slots.length === 1 ? '' : 's'} ·{' '}
                {template.workingDays.length} working day
                {template.workingDays.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(template.id)}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 dark:text-red-400"
                onClick={() => handleDelete(template)}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TemplateEditor({
  template,
  onDone,
}: {
  template: PeriodTemplate | null;
  onDone: () => void;
}) {
  const isEditing = !!template;
  const { mutateAsync: createTemplate, isPending: isCreating } =
    useCreatePeriodTemplate();
  const { mutateAsync: updateTemplate, isPending: isUpdating } =
    useUpdatePeriodTemplate();
  const isSaving = isCreating || isUpdating;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TemplateValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: template ? toFormValues(template) : EMPTY_TEMPLATE,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'slots' });
  const workingDays = watch('workingDays');
  const slotValues = watch('slots');

  const toggleDay = (day: number) => {
    const set = new Set(workingDays);
    if (set.has(day)) set.delete(day);
    else set.add(day);
    setValue(
      'workingDays',
      [...set].sort((a, b) => a - b),
      { shouldValidate: true },
    );
  };

  const onSubmit = async (values: TemplateValues) => {
    // Assign contiguous 1..N period numbers over PERIOD slots in row order.
    let periodCounter = 0;
    const slots = values.slots.map((slot, index) => {
      const isPeriod = slot.kind === 'PERIOD';
      if (isPeriod) periodCounter += 1;
      return {
        sortOrder: index,
        kind: slot.kind,
        label: slot.label,
        startTime: slot.startTime,
        endTime: slot.endTime,
        periodNumber: isPeriod ? periodCounter : null,
      };
    });

    const dto = {
      name: values.name,
      workingDays: values.workingDays,
      slots,
    };

    try {
      if (isEditing && template) {
        await updateTemplate({ id: template.id, dto });
        toast.success('Template updated.');
      } else {
        await createTemplate(dto);
        toast.success('Template created.');
      }
      onDone();
    } catch {
      toast.error('Could not save the template. Please try again.');
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-card p-5 space-y-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {isEditing ? 'Edit template' : 'New template'}
        </h3>
      </div>

      <Field data-invalid={!!errors.name}>
        <FieldLabel
          htmlFor="template-name"
          className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80"
        >
          Template Name <span className="text-red-500">*</span>
        </FieldLabel>
        <Input
          id="template-name"
          {...register('name')}
          disabled={isSaving}
          placeholder="e.g. Standard school day"
          className="h-9 max-w-md"
        />
        {errors.name && <FieldError>{errors.name.message}</FieldError>}
      </Field>

      {/* Working days */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Working Days <span className="text-red-500">*</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {ISO_WEEKDAYS.map((day) => {
            const active = workingDays.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                disabled={isSaving}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-zinc-200 dark:border-zinc-800 text-muted-foreground hover:text-foreground',
                )}
              >
                {day.label}
              </button>
            );
          })}
        </div>
        {errors.workingDays && (
          <FieldError>{errors.workingDays.message}</FieldError>
        )}
      </div>

      {/* Slots */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Slots <span className="text-red-500">*</span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={isSaving}
            onClick={() =>
              append({
                kind: 'PERIOD',
                label: `Period ${(slotValues ?? []).filter((s) => s.kind === 'PERIOD').length + 1}`,
                startTime: '',
                endTime: '',
              })
            }
          >
            <Plus className="h-3.5 w-3.5" /> Add Slot
          </Button>
        </div>

        <div className="space-y-2">
          {fields.map((field, index) => {
            const isPeriod = slotValues?.[index]?.kind === 'PERIOD';
            const periodNumber = isPeriod
              ? (slotValues ?? [])
                  .slice(0, index + 1)
                  .filter((s) => s.kind === 'PERIOD').length
              : null;
            const slotErrors = errors.slots?.[index];
            return (
              <div
                key={field.id}
                className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto_auto_auto] items-start gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-muted/20 p-2.5"
              >
                <div className="hidden sm:flex items-center h-9 text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                </div>

                <div className="space-y-1">
                  <select
                    {...register(`slots.${index}.kind` as const)}
                    disabled={isSaving}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                  >
                    {PERIOD_SLOT_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {KIND_LABELS[kind]}
                        {kind === 'PERIOD' && periodNumber
                          ? ` ${periodNumber}`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Input
                    {...register(`slots.${index}.label` as const)}
                    disabled={isSaving}
                    placeholder="Label"
                    className="h-9"
                  />
                  {slotErrors?.label && (
                    <p className="text-[10px] text-destructive">
                      {slotErrors.label.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Input
                    type="time"
                    {...register(`slots.${index}.startTime` as const)}
                    disabled={isSaving}
                    className="h-9"
                  />
                  {slotErrors?.startTime && (
                    <p className="text-[10px] text-destructive">
                      {slotErrors.startTime.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Input
                    type="time"
                    {...register(`slots.${index}.endTime` as const)}
                    disabled={isSaving}
                    className="h-9"
                  />
                  {slotErrors?.endTime && (
                    <p className="text-[10px] text-destructive">
                      {slotErrors.endTime.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center h-9">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 dark:text-red-400"
                    disabled={isSaving || fields.length === 1}
                    onClick={() => remove(index)}
                    title="Remove slot"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        {errors.slots && !Array.isArray(errors.slots) && (
          <FieldError>{errors.slots.message}</FieldError>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800 pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onDone}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving} className="gap-2">
          {isSaving
            ? 'Saving…'
            : isEditing
              ? 'Save Changes'
              : 'Create Template'}
        </Button>
      </div>
    </form>
  );
}
