'use client';

import { useMemo, useState } from 'react';

import {
  DraggableSlot,
  type MasterGridViewMode,
} from '@/components/timetable/studio/DraggableSlot';
import {
  type CellDropData,
  DroppableCell,
} from '@/components/timetable/studio/DroppableCell';
import { SlotDragOverlay } from '@/components/timetable/studio/SlotDragOverlay';
import { ISO_DAY_SHORT, templatePeriodNumbers } from '@/lib/timetable';
import { cn } from '@/lib/utils';
import type {
  MoveSlotDto,
  SwapSlotsDto,
  TimetableDetail,
  TimetableEditorSlot,
} from '@/services/api/requests/timetables';
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Info } from 'lucide-react';
import { toast } from 'sonner';

const VIEW_MODES: { key: MasterGridViewMode; label: string }[] = [
  { key: 'CLASS', label: 'By Class' },
  { key: 'TEACHER', label: 'By Teacher' },
  { key: 'ROOM', label: 'By Room' },
];

interface MasterGridProps {
  detail: TimetableDetail;
  slots: TimetableEditorSlot[];
  /** DRAFT status + manage permission. */
  canEdit: boolean;
  highlightSlotId: string | null;
  onMove: (variables: { slotId: string; dto: MoveSlotDto }) => void;
  onSwap: (dto: SwapSlotsDto) => void;
  onDeleteSlot: (slot: TimetableEditorSlot) => void;
}

interface GridRow {
  id: string;
  label: string;
}

export function MasterGrid({
  detail,
  slots,
  canEdit,
  highlightSlotId,
  onMove,
  onSwap,
  onDeleteSlot,
}: MasterGridProps) {
  const [viewMode, setViewMode] = useState<MasterGridViewMode>('CLASS');
  const [activeSlot, setActiveSlot] = useState<TimetableEditorSlot | null>(
    null,
  );

  // Click-to-open must survive: only start a drag after 6px of travel.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const workingDays = detail.periodTemplate.workingDays;
  const periodNumbers = useMemo(
    () => templatePeriodNumbers(detail.periodTemplate.slots),
    [detail],
  );

  const rows = useMemo<GridRow[]>(() => {
    const byId = new Map<string, GridRow>();
    for (const slot of slots) {
      if (viewMode === 'CLASS') {
        byId.set(slot.classId, { id: slot.classId, label: slot.class.name });
      } else if (viewMode === 'TEACHER') {
        if (slot.teacher) {
          byId.set(slot.teacher.membershipId, {
            id: slot.teacher.membershipId,
            label: slot.teacher.name,
          });
        }
      } else if (slot.room) {
        byId.set(slot.room.id, { id: slot.room.id, label: slot.room.name });
      }
    }
    return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [slots, viewMode]);

  const slotsByCell = useMemo(() => {
    const map = new Map<string, TimetableEditorSlot[]>();
    for (const slot of slots) {
      const rowId =
        viewMode === 'CLASS'
          ? slot.classId
          : viewMode === 'TEACHER'
            ? slot.teacher?.membershipId
            : slot.room?.id;
      if (!rowId) continue;
      const key = `${rowId}|${slot.dayOfWeek}|${slot.periodNumber}`;
      const bucket = map.get(key);
      if (bucket) bucket.push(slot);
      else map.set(key, [slot]);
    }
    return map;
  }, [slots, viewMode]);

  // v1: drag-and-drop only in BY CLASS view — moving a chip across a teacher
  // or room row would imply a reassignment the move contract doesn't express.
  const dragEnabled = canEdit && viewMode === 'CLASS';

  const handleDragStart = (event: DragStartEvent) => {
    const slot = event.active.data.current?.slot as
      | TimetableEditorSlot
      | undefined;
    setActiveSlot(slot ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveSlot(null);
    const slot = event.active.data.current?.slot as
      | TimetableEditorSlot
      | undefined;
    const target = event.over?.data.current as CellDropData | undefined;
    if (!slot || !target) return;
    if (target.rowId !== slot.classId) {
      toast.info('Slots can only be moved within their own class row.');
      return;
    }
    if (
      target.dayOfWeek === slot.dayOfWeek &&
      target.periodNumber === slot.periodNumber
    ) {
      return;
    }
    const occupant = slots.find(
      (candidate) =>
        candidate.classId === slot.classId &&
        candidate.dayOfWeek === target.dayOfWeek &&
        candidate.periodNumber === target.periodNumber &&
        candidate.id !== slot.id,
    );
    if (occupant) {
      onSwap({ slotIdA: slot.id, slotIdB: occupant.id });
    } else {
      onMove({
        slotId: slot.id,
        dto: { dayOfWeek: target.dayOfWeek, periodNumber: target.periodNumber },
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* View switcher */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-muted/40 p-1">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.key}
              type="button"
              onClick={() => setViewMode(mode.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                viewMode === mode.key
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
        {canEdit && viewMode !== 'CLASS' && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            Read-only view — drag slots in the By Class view.
          </span>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveSlot(null)}
      >
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900/60">
                <th className="sticky left-0 z-10 w-36 min-w-36 border-b border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {viewMode === 'CLASS'
                    ? 'Class'
                    : viewMode === 'TEACHER'
                      ? 'Teacher'
                      : 'Room'}
                </th>
                {workingDays.map((day) => (
                  <th
                    key={day}
                    colSpan={periodNumbers.length}
                    className="border-b border-r border-zinc-200 dark:border-zinc-800 px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-50"
                  >
                    {ISO_DAY_SHORT[day]}
                  </th>
                ))}
              </tr>
              <tr className="bg-zinc-50/60 dark:bg-zinc-900/40">
                <th className="sticky left-0 z-10 border-b border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900" />
                {workingDays.map((day) =>
                  periodNumbers.map((period) => (
                    <th
                      key={`${day}-${period}`}
                      className="min-w-24 border-b border-r border-zinc-200 dark:border-zinc-800 px-1 py-0.5 text-center text-[9px] font-medium text-muted-foreground"
                    >
                      P{period}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th className="sticky left-0 z-10 border-b border-r border-zinc-200 dark:border-zinc-800 bg-card px-3 py-1.5 text-left text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                    {row.label}
                  </th>
                  {workingDays.map((day) =>
                    periodNumbers.map((period) => {
                      const cellSlots =
                        slotsByCell.get(`${row.id}|${day}|${period}`) ?? [];
                      return (
                        <DroppableCell
                          key={`${row.id}-${day}-${period}`}
                          id={`cell|${row.id}|${day}|${period}`}
                          data={{
                            rowId: row.id,
                            dayOfWeek: day,
                            periodNumber: period,
                          }}
                          disabled={!dragEnabled}
                        >
                          <div className="flex flex-col gap-0.5">
                            {cellSlots.map((slot) => (
                              <DraggableSlot
                                key={slot.id}
                                slot={slot}
                                viewMode={viewMode}
                                dragEnabled={dragEnabled}
                                isHighlighted={highlightSlotId === slot.id}
                                onDelete={
                                  canEdit && viewMode === 'CLASS'
                                    ? onDeleteSlot
                                    : undefined
                                }
                              />
                            ))}
                          </div>
                        </DroppableCell>
                      );
                    }),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeSlot ? (
            <SlotDragOverlay slot={activeSlot} viewMode={viewMode} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
