'use client';

import { useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { Modal } from '@/components/modals/Modal';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { useClasses } from '@/services/api/requests/classes';
import {
  Notice,
  useCreateNotice,
  useUpdateNotice,
  NoticeScope,
} from '@/services/api/requests/notices';
import { useShowApiError } from '@/hooks/api/use-show-api-error';
import { useHideModal } from '@/hooks/use-modal';
import { usePermission } from '@/hooks/use-permission';
import { PERMS } from '@repo/permissions';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface NoticeModalProps {
  editingNotice?: Notice | null;
}

export function NoticeModal({ editingNotice = null }: NoticeModalProps) {
  const hideModal = useHideModal();
  const showError = useShowApiError();
  const { hasPermission } = usePermission();

  const { mutateAsync: createNotice, isPending: isCreating } = useCreateNotice();
  const { mutateAsync: updateNotice, isPending: isUpdating } = useUpdateNotice();
  const { data: classesData, isLoading: isLoadingClasses } = useClasses();

  // Format datetime for input
  const formatDatetimeLocal = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 16);
  };

  const scopeOptions = useMemo(() => {
    const options: { value: NoticeScope; label: string }[] = [];
    if (hasPermission(PERMS.notice.createClass)) {
      options.push({ value: 'CLASS', label: 'Class Only' });
    }
    if (hasPermission(PERMS.notice.createTeacher)) {
      options.push({ value: 'TEACHERS_ONLY', label: 'Teachers Only' });
    }
    if (hasPermission(PERMS.notice.createSchool)) {
      options.push({ value: 'SCHOOL_WIDE', label: 'School Wide' });
    }
    // Fallback if editing existing notice
    if (options.length === 0 && editingNotice) {
      options.push({ value: editingNotice.scope, label: editingNotice.scope });
    }
    return options;
  }, [hasPermission, editingNotice]);

  const classOptions = useMemo(() => {
    return (classesData ?? [])
      .filter((c) => c.status === 'ACTIVE')
      .map((c) => ({
        value: c.id,
        label: `${c.name} (${c.program?.code || ''})`,
      }));
  }, [classesData]);

  const formSchema = z
    .object({
      title: z.string().min(1, 'Title is required').max(200),
      scope: z.enum(['CLASS', 'TEACHERS_ONLY', 'SCHOOL_WIDE']),
      classIds: z.array(z.string()).optional(),
      content: z.string().min(1, 'Content is required'),
      sendImmediately: z.boolean(),
      startDate: z.string().optional(),
      endDate: z.string().min(1, 'End date is required'),
    })
    .refine(
      (data) => {
        if (data.scope === 'CLASS') {
          return data.classIds && data.classIds.length > 0;
        }
        return true;
      },
      {
        message: 'Please select at least one class',
        path: ['classIds'],
      }
    )
    .refine(
      (data) => {
        if (!data.sendImmediately && !data.startDate) {
          return false;
        }
        return true;
      },
      {
        message: 'Start date is required for scheduled notices',
        path: ['startDate'],
      }
    )
    .refine(
      (data) => {
        if (!data.sendImmediately && data.startDate && data.endDate) {
          return new Date(data.startDate) < new Date(data.endDate);
        }
        return true;
      },
      {
        message: 'End date must be after start date',
        path: ['endDate'],
      }
    );

  type FormValues = z.infer<typeof formSchema>;

  const defaultValues: Partial<FormValues> = editingNotice
    ? {
        title: editingNotice.title,
        scope: editingNotice.scope,
        classIds: editingNotice.classes?.map((c) => c.classId) || [],
        content: editingNotice.content,
        sendImmediately: new Date(editingNotice.startDate) <= new Date(),
        startDate: formatDatetimeLocal(editingNotice.startDate),
        endDate: formatDatetimeLocal(editingNotice.endDate),
      }
    : {
        title: '',
        scope: scopeOptions.length > 0 && scopeOptions[0] ? scopeOptions[0].value : 'CLASS',
        classIds: [],
        content: '',
        sendImmediately: true,
        startDate: formatDatetimeLocal(new Date().toISOString()),
        endDate: formatDatetimeLocal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()),
      };

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const watchScope = watch('scope');
  const watchSendImmediately = watch('sendImmediately');

  const onFormSubmit = async (data: FormValues) => {
    try {
      if (editingNotice) {
        await updateNotice({
          id: editingNotice.id,
          dto: {
            title: data.title,
            content: data.content,
            scope: data.scope,
            startDate: data.sendImmediately ? undefined : new Date(data.startDate!).toISOString(),
            endDate: new Date(data.endDate).toISOString(),
            classIds: data.scope === 'CLASS' ? data.classIds : undefined,
          },
        });
        toast.success('Notice updated successfully!');
      } else {
        await createNotice({
          title: data.title,
          content: data.content,
          scope: data.scope,
          sendImmediately: data.sendImmediately,
          startDate: data.sendImmediately ? undefined : new Date(data.startDate!).toISOString(),
          endDate: new Date(data.endDate).toISOString(),
          classIds: data.scope === 'CLASS' ? data.classIds : undefined,
        });
        toast.success('Notice created successfully!');
      }
      hideModal();
    } catch (error) {
      showError(error);
    }
  };

  const isSaving = isCreating || isUpdating;

  return (
    <Modal
      isOpen={true}
      onClose={hideModal}
      title={editingNotice ? 'Edit Notice' : 'Create Notice'}
      description={
        editingNotice
          ? 'Update the notice details and content.'
          : 'Create a new notice for classes, teachers, or the whole school.'
      }
      size="lg"
    >
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        <FieldGroup>
          <Field>
            <FieldLabel>Title *</FieldLabel>
            <Input placeholder="Enter notice title" {...register('title')} />
            {errors.title && <FieldError>{errors.title.message}</FieldError>}
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Scope *</FieldLabel>
              <Controller
                name="scope"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    options={scopeOptions}
                    value={field.value}
                    onChange={(val: string) => field.onChange(val as NoticeScope)}
                    placeholder="Select audience"
                  />
                )}
              />
              {errors.scope && <FieldError>{errors.scope.message}</FieldError>}
            </Field>

            {watchScope === 'CLASS' && (
              <Field>
                <FieldLabel>Target Classes *</FieldLabel>
                <Controller
                  name="classIds"
                  control={control}
                  render={({ field }) => (
                    <div className="relative">
                      {isLoadingClasses ? (
                        <div className="h-10 flex items-center px-3 text-sm text-zinc-500 border rounded-md">Loading classes...</div>
                      ) : (
                        <div className="max-h-36 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-md p-2 space-y-2 bg-white dark:bg-zinc-950">
                          {classOptions.map((opt) => (
                            <div key={opt.value} className="flex items-center space-x-2">
                              <Checkbox
                                id={`class-${opt.value}`}
                                checked={field.value?.includes(opt.value)}
                                onCheckedChange={(checked: boolean) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, opt.value]);
                                  } else {
                                    field.onChange(current.filter((val: string) => val !== opt.value));
                                  }
                                }}
                              />
                              <Label htmlFor={`class-${opt.value}`} className="text-sm font-normal cursor-pointer">{opt.label}</Label>
                            </div>
                          ))}
                          {classOptions.length === 0 && (
                            <div className="text-sm text-zinc-500 p-2">No active classes found.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                />
                {errors.classIds && <FieldError>{errors.classIds.message}</FieldError>}
              </Field>
            )}
          </div>

          <Field>
            <FieldLabel>Content *</FieldLabel>
            <Controller
              name="content"
              control={control}
              render={({ field }) => (
                <RichTextEditor
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Write your notice here..."
                />
              )}
            />
            {errors.content && <FieldError>{errors.content.message}</FieldError>}
          </Field>

          <div className="border border-zinc-200 dark:border-zinc-800 rounded-md p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-900/20">
            <h4 className="text-sm font-semibold">Visibility Schedule</h4>
            
            <Controller
              name="sendImmediately"
              control={control}
              render={({ field }) => (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sendImmediately"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <Label htmlFor="sendImmediately" className="font-medium cursor-pointer">
                    Publish immediately
                  </Label>
                </div>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!watchSendImmediately && (
                <Field>
                  <FieldLabel>Start Date & Time</FieldLabel>
                  <Input
                    type="datetime-local"
                    {...register('startDate')}
                  />
                  {errors.startDate && <FieldError>{errors.startDate.message}</FieldError>}
                </Field>
              )}
              <Field>
                <FieldLabel>Valid Until (End Date)</FieldLabel>
                <Input
                  type="datetime-local"
                  {...register('endDate')}
                />
                {errors.endDate && <FieldError>{errors.endDate.message}</FieldError>}
              </Field>
            </div>
          </div>
        </FieldGroup>

        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <Button type="button" variant="outline" onClick={hideModal}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : editingNotice ? 'Save Changes' : 'Create Notice'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
