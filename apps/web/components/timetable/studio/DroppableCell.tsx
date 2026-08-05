'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import type { TimetableEditorSlot } from '@/services/api/requests/timetables';
import { useDroppable } from '@dnd-kit/core';

export interface CellDropData {
  rowId: string;
  dayOfWeek: number;
  periodNumber: number;
}

interface DroppableCellProps {
  id: string;
  data: CellDropData;
  disabled: boolean;
  children: ReactNode;
}

export function DroppableCell({
  id,
  data,
  disabled,
  children,
}: DroppableCellProps) {
  const { setNodeRef, isOver, active } = useDroppable({ id, data, disabled });

  const draggedSlot = active?.data.current?.slot as
    | TimetableEditorSlot
    | undefined;
  // In BY CLASS view a slot may only land on its own class's row.
  const isValidTarget = !!draggedSlot && draggedSlot.classId === data.rowId;

  return (
    <td
      ref={setNodeRef}
      className={cn(
        'h-12 min-w-24 border-b border-r border-zinc-200 dark:border-zinc-800 p-0.5 align-top transition-colors',
        isOver && isValidTarget && 'bg-emerald-500/15',
        isOver && draggedSlot && !isValidTarget && 'bg-red-500/10',
        !isOver && draggedSlot && isValidTarget && 'bg-emerald-500/5',
      )}
    >
      {children}
    </td>
  );
}
