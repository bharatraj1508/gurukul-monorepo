'use client';

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';

import { Modal } from '@/components/modals/Modal';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Textarea } from '@/components/ui/textarea';
import { useShowApiError } from '@/hooks/api/use-show-api-error';
import { useHideModal } from '@/hooks/use-modal';
import { ISO_DAY_SHORT, getIsoDay } from '@/lib/timetable';
import { useAcademicTerms } from '@/services/api/requests/academic-terms';
import { useClasses, useInstructors } from '@/services/api/requests/classes';
import {
  type TimetableSubstitution,
  useCreateSubstitution,
  useUpdateSubstitution,
} from '@/services/api/requests/timetable-config';
import {
  useTimetableSlots,
  useTimetables,
} from '@/services/api/requests/timetables';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { z } from 'zod';

const substitutionSchema = z.object({
  date: z.string().min(1, 'Pick a date.'),
  classId: z.string().min(1, 'Pick a class.'),
  timetableSlotId: z.string().min(1, 'Pick the period to substitute.'),
  substituteTeacherMembershipId: z
    .string()
    .min(1, 'Pick the substitute teacher.'),
  reason: z
    .string()
    .trim()
    .max(200, 'Reason must be 200 characters or fewer.')
    .optional()
    .or(z.literal('')),
});

type SubstitutionValues = z.infer<typeof substitutionSchema>;

interface TimetableSubstitutionModalProps {
  editingSubstitution: TimetableSubstitution | null;
  defaultDate?: string;
}

export function TimetableSubstitutionModal({
  editingSubstitution,
  defaultDate,
}: TimetableSubstitutionModalProps) {
  const hideModal = useHideModal();
  const showError = useShowApiError();
  const isEditing = !!editingSubstitution;

  const { mutateAsync: createSubstitution, isPending: isCreating } =
    useCreateSubstitution();
  const { mutateAsync: updateSubstitution, isPending: isUpdating } =
    useUpdateSubstitution();
  const isSaving = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SubstitutionValues>({
    resolver: zodResolver(substitutionSchema),
    defaultValues: isEditing
      ? {
          date: editingSubstitution.date,
          classId: editingSubstitution.slot?.classId ?? '',
          timetableSlotId: editingSubstitution.timetableSlotId,
          substituteTeacherMembershipId:
            editingSubstitution.substituteTeacherMembershipId,
          reason: editingSubstitution.reason ?? '',
        }
      : {
          date: defaultDate ?? format(new Date(), 'yyyy-MM-dd'),
          classId: '',
          timetableSlotId: '',
          substituteTeacherMembershipId: '',
          reason: '',
        },
  });

  const date = watch('date');
  const classId = watch('classId');

  // Substitutions apply to the published timetable of the active term.
  const { data: terms } = useAcademicTerms();
  const activeTerm = useMemo(() => terms?.find((t) => t.isActive), [terms]);

  const { data: classes, isLoading: isLoadingClasses } = useClasses(
    activeTerm ? { term: activeTerm.id } : undefined,
  );
  const { data: publishedList } = useTimetables(
    activeTerm
      ? { academicTermId: activeTerm.id, status: 'PUBLISHED' }
      : undefined,
  );
  const publishedTimetable = publishedList?.[0];
  const { data: publishedSlots, isLoading: isLoadingSlots } = useTimetableSlots(
    publishedTimetable?.id ?? '',
    !!publishedTimetable,
  );

  const { data: instructors, isLoading: isLoadingInstructors } =
    useInstructors();

  const classOptions = useMemo(
    () => (classes ?? []).map((c) => ({ value: c.id, label: c.name })),
    [classes],
  );

  const isoDay = date ? getIsoDay(parseISO(date)) : null;
  const slotOptions = useMemo(() => {
    if (!publishedSlots || !classId || isoDay == null) return [];
    return publishedSlots
      .filter((slot) => slot.classId === classId && slot.dayOfWeek === isoDay)
      .sort((a, b) => a.periodNumber - b.periodNumber)
      .map((slot) => ({
        value: slot.id,
        label: `P${slot.periodNumber} · ${slot.course.name}`,
        description: slot.teacher
          ? `Regular teacher: ${slot.teacher.name}`
          : 'No regular teacher',
      }));
  }, [publishedSlots, classId, isoDay]);

  const teacherOptions = useMemo(
    () =>
      (instructors ?? []).map((instructor) => ({
        value: instructor.membershipId,
        label: `${instructor.firstName} ${instructor.lastName}`,
        description: instructor.email,
      })),
    [instructors],
  );

  const onSubmit = async (values: SubstitutionValues) => {
    try {
      if (isEditing) {
        await updateSubstitution({
          id: editingSubstitution.id,
          dto: {
            substituteTeacherMembershipId: values.substituteTeacherMembershipId,
            reason: values.reason || undefined,
          },
        });
        toast.success('Substitution updated successfully!');
      } else {
        await createSubstitution({
          timetableSlotId: values.timetableSlotId,
          date: values.date,
          substituteTeacherMembershipId: values.substituteTeacherMembershipId,
          reason: values.reason || undefined,
        });
        toast.success('Substitution recorded successfully!');
      }
      hideModal();
    } catch (err) {
      showError(err);
    }
  };

  const noPublished = !!activeTerm && publishedList && !publishedTimetable;

  return (
    <Modal
      isOpen={true}
      onClose={hideModal}
      title={isEditing ? 'Edit Substitution' : 'Record Substitution'}
      description={
        isEditing
          ? 'Change the covering teacher or the reason.'
          : 'Assign a covering teacher for a period on a specific date.'
      }
      size="md"
      primaryAction={{
        label: isSaving
          ? 'Saving...'
          : isEditing
            ? 'Save Changes'
            : 'Record Substitution',
        onClick: handleSubmit(onSubmit),
        loading: isSaving,
        disabled: isSaving || (!isEditing && !publishedTimetable),
      }}
      secondaryAction={{
        label: 'Cancel',
        onClick: hideModal,
        disabled: isSaving,
      }}
    >
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        {noPublished && !isEditing && (
          <p className="rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            No published timetable for the active term yet — publish one before
            recording substitutions.
          </p>
        )}

        <FieldGroup className="gap-5">
          <Field data-invalid={!!errors.date}>
            <FieldLabel
              htmlFor="substitution-date"
              className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80"
            >
              Date <span className="text-red-500">*</span>
              {isoDay != null && (
                <span className="ml-2 normal-case font-normal text-muted-foreground">
                  ({ISO_DAY_SHORT[isoDay]})
                </span>
              )}
            </FieldLabel>
            <Input
              id="substitution-date"
              type="date"
              {...register('date')}
              disabled={isSaving || isEditing}
              className="h-10 text-sm focus-visible:ring-primary/30"
            />
            {errors.date && <FieldError>{errors.date.message}</FieldError>}
          </Field>

          {isEditing ? (
            <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-muted/30 px-3 py-2 text-xs">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">
                {editingSubstitution.slot?.className} · P
                {editingSubstitution.slot?.periodNumber} ·{' '}
                {editingSubstitution.slot?.courseName}
              </p>
              {editingSubstitution.slot?.teacherName && (
                <p className="text-muted-foreground">
                  Regular teacher: {editingSubstitution.slot.teacherName}
                </p>
              )}
            </div>
          ) : (
            <>
              <Field data-invalid={!!errors.classId}>
                <FieldLabel
                  htmlFor="substitution-class"
                  className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80"
                >
                  Class <span className="text-red-500">*</span>
                </FieldLabel>
                <SearchableSelect
                  id="substitution-class"
                  options={classOptions}
                  placeholder="-- Select class --"
                  disabled={isSaving || isLoadingClasses}
                  {...register('classId')}
                />
                {errors.classId && (
                  <FieldError>{errors.classId.message}</FieldError>
                )}
              </Field>

              <Field data-invalid={!!errors.timetableSlotId}>
                <FieldLabel
                  htmlFor="substitution-slot"
                  className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80"
                >
                  Period <span className="text-red-500">*</span>
                </FieldLabel>
                <SearchableSelect
                  id="substitution-slot"
                  options={slotOptions}
                  placeholder={
                    !classId
                      ? '-- Pick a class first --'
                      : slotOptions.length === 0
                        ? '-- No periods for this class on that day --'
                        : '-- Select period --'
                  }
                  disabled={isSaving || isLoadingSlots || !classId}
                  {...register('timetableSlotId')}
                />
                {errors.timetableSlotId && (
                  <FieldError>{errors.timetableSlotId.message}</FieldError>
                )}
              </Field>
            </>
          )}

          <Field data-invalid={!!errors.substituteTeacherMembershipId}>
            <FieldLabel
              htmlFor="substitution-teacher"
              className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80"
            >
              Substitute Teacher <span className="text-red-500">*</span>
            </FieldLabel>
            <SearchableSelect
              id="substitution-teacher"
              options={teacherOptions}
              placeholder="-- Select teacher --"
              disabled={isSaving || isLoadingInstructors}
              {...register('substituteTeacherMembershipId')}
            />
            {errors.substituteTeacherMembershipId && (
              <FieldError>
                {errors.substituteTeacherMembershipId.message}
              </FieldError>
            )}
          </Field>

          <Field data-invalid={!!errors.reason}>
            <FieldLabel
              htmlFor="substitution-reason"
              className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80"
            >
              Reason
            </FieldLabel>
            <Textarea
              id="substitution-reason"
              {...register('reason')}
              disabled={isSaving}
              placeholder="e.g. Medical leave"
              rows={2}
              className="text-sm focus-visible:ring-primary/30"
            />
            {errors.reason && <FieldError>{errors.reason.message}</FieldError>}
          </Field>
        </FieldGroup>
      </form>
    </Modal>
  );
}
