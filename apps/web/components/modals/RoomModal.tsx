'use client';

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
import { useShowApiError } from '@/hooks/api/use-show-api-error';
import { useHideModal } from '@/hooks/use-modal';
import {
  ROOM_TYPES,
  ROOM_TYPE_LABELS,
  type Room,
  useCreateRoom,
  useUpdateRoom,
} from '@/services/api/requests/rooms';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';

const roomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Room name is required.')
    .max(100, 'Room name must be 100 characters or fewer.'),
  type: z.enum([
    'CLASSROOM',
    'SCIENCE_LAB',
    'COMPUTER_LAB',
    'SPORTS',
    'AUDITORIUM',
    'OTHER',
  ]),
  capacity: z
    .number({ message: 'Capacity must be a number.' })
    .int('Capacity must be a whole number.')
    .min(1, 'Capacity must be at least 1.')
    .max(10000, 'Capacity looks too large.'),
});

type RoomValues = z.infer<typeof roomSchema>;

const ROOM_TYPE_OPTIONS = ROOM_TYPES.map((type) => ({
  value: type,
  label: ROOM_TYPE_LABELS[type],
}));

interface RoomModalProps {
  editingRoom: Room | null;
}

export function RoomModal({ editingRoom }: RoomModalProps) {
  const hideModal = useHideModal();
  const showError = useShowApiError();
  const isEditing = !!editingRoom;

  const { mutateAsync: createRoom, isPending: isCreating } = useCreateRoom();
  const { mutateAsync: updateRoom, isPending: isUpdating } = useUpdateRoom();
  const isSaving = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RoomValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: isEditing
      ? {
          name: editingRoom.name,
          type: editingRoom.type,
          capacity: editingRoom.capacity,
        }
      : {
          name: '',
          type: 'CLASSROOM',
          capacity: 40,
        },
  });

  const onSubmit = async (values: RoomValues) => {
    try {
      if (isEditing) {
        await updateRoom({ id: editingRoom.id, dto: values });
        toast.success('Room updated successfully!');
      } else {
        await createRoom(values);
        toast.success('Room created successfully!');
      }
      hideModal();
    } catch (err) {
      showError(err);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={hideModal}
      title={isEditing ? 'Edit Room' : 'Add Room'}
      description={
        isEditing
          ? 'Update room details used by the timetable generator.'
          : 'Rooms are used for lab/venue placement during generation.'
      }
      size="md"
      primaryAction={{
        label: isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Room',
        onClick: handleSubmit(onSubmit),
        loading: isSaving,
        disabled: isSaving,
      }}
      secondaryAction={{
        label: 'Cancel',
        onClick: hideModal,
        disabled: isSaving,
      }}
    >
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup className="gap-5">
          <Field data-invalid={!!errors.name}>
            <FieldLabel
              htmlFor="room-name"
              className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80"
            >
              Name <span className="text-red-500">*</span>
            </FieldLabel>
            <Input
              id="room-name"
              {...register('name')}
              disabled={isSaving}
              placeholder="e.g. Physics Lab 1"
              className="h-10 text-sm focus-visible:ring-primary/30"
            />
            {errors.name && <FieldError>{errors.name.message}</FieldError>}
          </Field>

          <Field data-invalid={!!errors.type}>
            <FieldLabel
              htmlFor="room-type"
              className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80"
            >
              Type <span className="text-red-500">*</span>
            </FieldLabel>
            <SearchableSelect
              id="room-type"
              options={ROOM_TYPE_OPTIONS}
              placeholder="-- Select type --"
              disabled={isSaving}
              {...register('type')}
            />
            {errors.type && <FieldError>{errors.type.message}</FieldError>}
          </Field>

          <Field data-invalid={!!errors.capacity}>
            <FieldLabel
              htmlFor="room-capacity"
              className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80"
            >
              Capacity <span className="text-red-500">*</span>
            </FieldLabel>
            <Input
              id="room-capacity"
              type="number"
              min={1}
              {...register('capacity', { valueAsNumber: true })}
              disabled={isSaving}
              className="h-10 text-sm focus-visible:ring-primary/30"
            />
            {errors.capacity && (
              <FieldError>{errors.capacity.message}</FieldError>
            )}
          </Field>
        </FieldGroup>
      </form>
    </Modal>
  );
}
