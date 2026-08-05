'use client';

import {
  type MasterGridViewMode,
  slotPrimaryLabel,
  slotSecondaryLabel,
} from '@/components/timetable/studio/DraggableSlot';
import { courseColorClasses } from '@/lib/timetable';
import { cn } from '@/lib/utils';
import type { TimetableEditorSlot } from '@/services/api/requests/timetables';

interface SlotDragOverlayProps {
  slot: TimetableEditorSlot;
  viewMode: MasterGridViewMode;
}

/** Rendered inside dnd-kit's DragOverlay while a slot is in flight. */
export function SlotDragOverlay({ slot, viewMode }: SlotDragOverlayProps) {
  return (
    <div
      className={cn(
        'w-28 rounded-md border px-1.5 py-1 shadow-lg rotate-2 cursor-grabbing',
        courseColorClasses(slot.courseId),
      )}
    >
      <span className="block truncate text-[10px] font-semibold leading-tight">
        {slotPrimaryLabel(slot, viewMode)}
      </span>
      <span className="block truncate text-[9px] leading-tight opacity-80">
        {slotSecondaryLabel(slot, viewMode)}
      </span>
    </div>
  );
}
