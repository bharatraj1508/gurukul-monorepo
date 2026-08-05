'use client';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useShowDeleteModal, useShowRoomModal } from '@/hooks/use-modal';
import {
  ROOM_TYPE_LABELS,
  type Room,
  useDeleteRoom,
  useRooms,
} from '@/services/api/requests/rooms';
import { DoorOpen, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function RoomsContainer() {
  const { data: rooms, isLoading } = useRooms();
  const showRoomModal = useShowRoomModal();
  const showDeleteModal = useShowDeleteModal();
  const { mutateAsync: deleteRoom } = useDeleteRoom();

  const handleDelete = (room: Room) => {
    showDeleteModal({
      title: 'Delete this room?',
      subtitle: `“${room.name}” will be removed. Timetables that reference it may need re-generating.`,
      confirmButtonText: 'Delete',
      onConfirm: async () => {
        try {
          await deleteRoom(room.id);
          toast.success('Room deleted.');
        } catch {
          toast.error('Could not delete the room. Please try again.');
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Rooms
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Classrooms, labs, and specialised spaces the solver can assign.
          </p>
        </div>
        <Button onClick={() => showRoomModal(null)} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> New Room
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-11 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 animate-pulse"
            />
          ))}
        </div>
      ) : !rooms?.length ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-3">
            <DoorOpen className="h-7 w-7 text-primary opacity-80" />
          </div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
            No rooms yet
          </h3>
          <p className="text-zinc-500 max-w-sm mb-5 text-sm">
            Add the rooms available at your school so lessons can be placed in
            the right spaces.
          </p>
          <Button
            onClick={() => showRoomModal(null)}
            variant="outline"
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> New Room
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50 dark:bg-zinc-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                <TableHead>Name</TableHead>
                <TableHead className="w-40">Type</TableHead>
                <TableHead className="w-32">Capacity</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-medium text-zinc-900 dark:text-zinc-50">
                    {room.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ROOM_TYPE_LABELS[room.type]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {room.capacity}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => showRoomModal(room)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 dark:text-red-400"
                        onClick={() => handleDelete(room)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
