'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Modal } from '@/components/modals/Modal';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Textarea } from '@/components/ui/textarea';
import { useShowApiError } from '@/hooks/api/use-show-api-error';
import { useHideModal } from '@/hooks/use-modal';
import {
  Diary,
  useCreateDiary,
  useDiaryOptions,
  useUpdateDiary,
} from '@/services/api/requests/diary';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';

interface DiaryModalProps {
  editingDiary: Diary | null;
  presetClassId?: string;
}

const diaryFormSchema = z.object({
  classId: z.string().optional(),
  courseId: z.string().optional(),
  note: z.string().trim().min(1, 'Please enter a note'),
});
type FormValues = z.infer<typeof diaryFormSchema>;

export function DiaryModal({ editingDiary, presetClassId }: DiaryModalProps) {
  const hideModal = useHideModal();
  const showError = useShowApiError();
  const isEditing = !!editingDiary;
  const isClassLocked = isEditing || !!presetClassId;

  const { data: options, isLoading } = useDiaryOptions();
  const { mutateAsync: createDiary, isPending: isCreating } = useCreateDiary();
  const { mutateAsync: updateDiary, isPending: isUpdating } = useUpdateDiary();

  const [studentIds, setStudentIds] = useState<string[]>(
    editingDiary?.studentIds ?? [],
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(diaryFormSchema),
    defaultValues: {
      classId: editingDiary?.classId ?? presetClassId ?? '',
      courseId: editingDiary?.courseId ?? '',
      note: editingDiary?.note ?? '',
    },
  });

  const watchedClassId = watch('classId');
  const activeClassId = isEditing
    ? editingDiary!.classId
    : (presetClassId ?? watchedClassId);

  const selectedClass = useMemo(
    () => (options ?? []).find((c) => c.id === activeClassId) ?? null,
    [options, activeClassId],
  );

  const classOptions = useMemo(
    () =>
      (options ?? []).map((c) => ({
        value: c.id,
        label: c.program ? `${c.name} — ${c.program.name}` : c.name,
      })),
    [options],
  );

  const courseOptions = useMemo(
    () => [
      { value: '', label: 'General (no specific course)' },
      ...(selectedClass?.courses ?? []).map((c) => ({
        value: c.id,
        label: `${c.name} (${c.code})`,
      })),
    ],
    [selectedClass],
  );

  // On class change (create flow with a selectable class), reset course +
  // student selection.
  useEffect(() => {
    if (isClassLocked) return;
    setValue('courseId', '');
    setStudentIds([]);
  }, [watchedClassId, isClassLocked, setValue]);

  const toggleStudent = (id: string) =>
    setStudentIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );

  const onSubmit = async (data: FormValues) => {
    try {
      if (isEditing) {
        await updateDiary({
          id: editingDiary!.id,
          dto: {
            note: data.note,
            courseId: data.courseId || null,
            studentIds,
          },
        });
        toast.success('Diary note updated.');
      } else {
        const classId = presetClassId ?? data.classId;
        if (!classId || !selectedClass?.program || !selectedClass?.term) {
          setError('classId', { message: 'Please select a class' });
          return;
        }
        await createDiary({
          termId: selectedClass.term.id,
          programId: selectedClass.program.id,
          classId,
          courseId: data.courseId || undefined,
          note: data.note,
          studentIds,
        });
        toast.success('Diary note created.');
      }
      hideModal();
    } catch (error) {
      showError(error);
    }
  };

  const isSaving = isCreating || isUpdating;
  const students = selectedClass?.students ?? [];

  return (
    <Modal
      isOpen={true}
      onClose={hideModal}
      title={isEditing ? 'Edit Diary Note' : 'New Diary Note'}
      description={
        isEditing
          ? 'Update this work diary note.'
          : 'Post a note to a class — optionally scoped to a course or specific students.'
      }
    >
      {isLoading ? (
        <div className="py-10 flex flex-col items-center justify-center text-zinc-500">
          <div className="h-6 w-6 animate-spin border-2 border-primary border-t-transparent rounded-full mb-2" />
          <span className="text-xs">Loading classes...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <FieldGroup>
            {/* Class */}
            <Field>
              <FieldLabel>Class *</FieldLabel>
              {isClassLocked ? (
                <div className="rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {selectedClass?.name ?? editingDiary?.class?.name ?? 'Class'}
                </div>
              ) : (
                <SearchableSelect
                  options={classOptions}
                  placeholder="Select a class"
                  {...register('classId')}
                />
              )}
              {errors.classId && (
                <FieldError>{errors.classId.message}</FieldError>
              )}
              {selectedClass && (
                <p className="text-[11px] text-muted-foreground">
                  {selectedClass.program?.name} · {selectedClass.term?.name}
                </p>
              )}
            </Field>

            {/* Course (optional) */}
            <Field>
              <FieldLabel>Course (optional)</FieldLabel>
              <SearchableSelect
                options={courseOptions}
                placeholder="General (no specific course)"
                disabled={!selectedClass}
                {...register('courseId')}
              />
            </Field>

            {/* Students (optional) */}
            <Field>
              <FieldLabel>
                Students (optional){' '}
                <span className="text-[11px] font-normal text-muted-foreground">
                  {studentIds.length === 0
                    ? '— all students of the class'
                    : `— ${studentIds.length} selected`}
                </span>
              </FieldLabel>
              <div className="max-h-40 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                {students.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">
                    {selectedClass
                      ? 'No active students in this class.'
                      : 'Select a class to choose students.'}
                  </p>
                ) : (
                  students.map((s) => (
                    <label
                      key={s.studentProfileId}
                      className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={studentIds.includes(s.studentProfileId)}
                        onChange={() => toggleStudent(s.studentProfileId)}
                      />
                      <span>
                        {s.firstName} {s.lastName}
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-auto">
                        #{s.rollNumber}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </Field>

            {/* Note */}
            <Field>
              <FieldLabel>Note *</FieldLabel>
              <Textarea
                rows={4}
                placeholder="e.g. Bring your art supplies tomorrow."
                {...register('note')}
              />
              {errors.note && <FieldError>{errors.note.message}</FieldError>}
            </Field>
          </FieldGroup>

          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <Button type="button" variant="outline" onClick={hideModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving
                ? 'Saving...'
                : isEditing
                  ? 'Save Changes'
                  : 'Create Note'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
