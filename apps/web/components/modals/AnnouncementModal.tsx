'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { Modal } from '@/components/modals/Modal';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
  Announcement,
  useCreateAnnouncement,
  useUpdateAnnouncement,
} from '@/services/api/requests/announcements';
import { useShowApiError } from '@/hooks/api/use-show-api-error';
import { useHideModal } from '@/hooks/use-modal';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface AnnouncementModalProps {
  editingAnnouncement?: Announcement | null;
}

export function AnnouncementModal({ editingAnnouncement = null }: AnnouncementModalProps) {
  const hideModal = useHideModal();
  const showError = useShowApiError();

  const { mutateAsync: createAnnouncement, isPending: isCreating } = useCreateAnnouncement();
  const { mutateAsync: updateAnnouncement, isPending: isUpdating } = useUpdateAnnouncement();

  const formatDatetimeLocal = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 16);
  };

  const formSchema = z
    .object({
      title: z.string().min(1, 'Title is required').max(200),
      content: z.string().min(1, 'Content is required'),
      sendImmediately: z.boolean(),
      startDate: z.string().optional(),
      endDate: z.string().min(1, 'End date is required'),
    })
    .refine(
      (data) => {
        if (!data.sendImmediately && !data.startDate) {
          return false;
        }
        return true;
      },
      {
        message: 'Start date is required for scheduled announcements',
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

  const defaultValues: Partial<FormValues> = editingAnnouncement
    ? {
        title: editingAnnouncement.title,
        content: editingAnnouncement.content,
        sendImmediately: new Date(editingAnnouncement.startDate) <= new Date(),
        startDate: formatDatetimeLocal(editingAnnouncement.startDate),
        endDate: formatDatetimeLocal(editingAnnouncement.endDate),
      }
    : {
        title: '',
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

  const watchSendImmediately = watch('sendImmediately');

  const onFormSubmit = async (data: FormValues) => {
    try {
      if (editingAnnouncement) {
        await updateAnnouncement({
          id: editingAnnouncement.id,
          dto: {
            title: data.title,
            content: data.content,
            startDate: data.sendImmediately ? undefined : new Date(data.startDate!).toISOString(),
            endDate: new Date(data.endDate).toISOString(),
          },
        });
        toast.success('Announcement updated!');
      } else {
        await createAnnouncement({
          title: data.title,
          content: data.content,
          sendImmediately: data.sendImmediately,
          startDate: data.sendImmediately ? undefined : new Date(data.startDate!).toISOString(),
          endDate: new Date(data.endDate).toISOString(),
        });
        toast.success('School announcement submitted for approval!');
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
      title={editingAnnouncement ? 'Edit School Announcement' : 'New School Announcement'}
      description={
        editingAnnouncement
          ? 'Update announcement details.'
          : 'Create an announcement for the whole school. Principals must approve before it appears on the dashboard.'
      }
      size="lg"
    >
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        <FieldGroup>
          <Field>
            <FieldLabel>Announcement Title *</FieldLabel>
            <Input placeholder="e.g. Annual Sports Day Celebration" {...register('title')} />
            {errors.title && <FieldError>{errors.title.message}</FieldError>}
          </Field>

          <Field>
            <FieldLabel>Content *</FieldLabel>
            <Controller
              name="content"
              control={control}
              render={({ field }) => (
                <RichTextEditor
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Write the announcement details..."
                />
              )}
            />
            {errors.content && <FieldError>{errors.content.message}</FieldError>}
          </Field>

          <div className="border border-zinc-200 dark:border-zinc-800 rounded-md p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-900/20">
            <h4 className="text-sm font-semibold">Visibility Window</h4>
            
            <Controller
              name="sendImmediately"
              control={control}
              render={({ field }) => (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sendImmediatelyAnn"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <Label htmlFor="sendImmediatelyAnn" className="font-medium cursor-pointer">
                    Publish immediately upon approval
                  </Label>
                </div>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!watchSendImmediately && (
                <Field>
                  <FieldLabel>Publish Start Date</FieldLabel>
                  <Input
                    type="datetime-local"
                    {...register('startDate')}
                  />
                  {errors.startDate && <FieldError>{errors.startDate.message}</FieldError>}
                </Field>
              )}
              <Field>
                <FieldLabel>Expiry Date (Valid Until)</FieldLabel>
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
            {isSaving ? 'Submitting...' : editingAnnouncement ? 'Save Changes' : 'Submit Announcement'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
