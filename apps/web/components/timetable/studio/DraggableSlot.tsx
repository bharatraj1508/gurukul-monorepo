'use client';

import { courseColorClasses } from '@/lib/timetable';
import { cn } from '@/lib/utils';
import type { TimetableEditorSlot } from '@/services/api/requests/timetables';
import { useDraggable } from '@dnd-kit/core';
import { X } from 'lucide-react';

export type MasterGridViewMode = 'CLASS' | 'TEACHER' | 'ROOM';

export function slotPrimaryLabel(
  slot: TimetableEditorSlot,
  viewMode: MasterGridViewMode,
): string {
  return viewMode === 'CLASS' ? slot.course.name : slot.class.name;
}

export function slotSecondaryLabel(
  slot: TimetableEditorSlot,
  viewMode: MasterGridViewMode,
): string {
  if (viewMode === 'CLASS') {
    return [slot.teacher?.name, slot.room?.name].filter(Boolean).join(' · ');
  }
  if (viewMode === 'TEACHER') {
    return [slot.course.name, slot.room?.name].filter(Boolean).join(' · ');
  }
  return [slot.course.name, slot.teacher?.name].filter(Boolean).join(' · ');
}

interface DraggableSlotProps {
  slot: TimetableEditorSlot;
  viewMode: MasterGridViewMode;
  dragEnabled: boolean;
  isHighlighted: boolean;
  onDelete?: (slot: TimetableEditorSlot) => void;
}

export function DraggableSlot({
  slot,
  viewMode,
  dragEnabled,
  isHighlighted,
  onDelete,
}: DraggableSlotProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: slot.id,
    data: { slot },
    disabled: !dragEnabled,
  });

  return (
    <div
      ref={setNodeRef}
      id={`tt-slot-${slot.id}`}
      {...attributes}
      {...listeners}
      className={cn(
        'group relative w-full rounded-md border px-1.5 py-1 text-left select-none',
        courseColorClasses(slot.courseId),
        dragEnabled && 'cursor-grab active:cursor-grabbing touch-none',
        isDragging && 'opacity-40',
        isHighlighted &&
          'ring-2 ring-amber-500 ring-offset-1 ring-offset-background',
      )}
    >
      <span className="block truncate text-[10px] font-semibold leading-tight">
        {slotPrimaryLabel(slot, viewMode)}
      </span>
      <span className="block truncate text-[9px] leading-tight opacity-80">
        {slotSecondaryLabel(slot, viewMode)}
      </span>
      {onDelete && (
        <button
          type="button"
          title="Remove this slot"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(slot);
          }}
          className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow group-hover:flex"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}
