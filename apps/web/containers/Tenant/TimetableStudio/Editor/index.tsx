'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { GenerationProgress } from '@/components/timetable/studio/GenerationProgress';
import { MasterGrid } from '@/components/timetable/studio/MasterGrid';
import { TimetableStatusBadge } from '@/components/timetable/studio/TimetableStatusBadge';
import { ViolationsPanel } from '@/components/timetable/studio/ViolationsPanel';
import { Button } from '@/components/ui/button';
import {
  useShowDeleteModal,
  useShowGenerateTimetableModal,
} from '@/hooks/use-modal';
import { usePermission } from '@/hooks/use-permission';
import { useRequirePermission } from '@/hooks/use-require-permission';
import {
  type TimetableEditorSlot,
  type TimetableViolation,
  slotMutationKey,
  useDeleteSlot,
  useDuplicateTimetable,
  useMoveSlot,
  usePublishTimetable,
  useSwapSlots,
  useTimetable,
  useTimetableSlots,
  useTimetableStatus,
} from '@/services/api/requests/timetables';
import { useIsMutating } from '@tanstack/react-query';
import { ArrowLeft, Check, Copy, Loader2, Rocket } from 'lucide-react';
import { toast } from 'sonner';

import { PERMS } from '@repo/permissions';

interface TimetableEditorContainerProps {
  timetableId: string;
}

/**
 * Resolves the slot that a violation refers to, so selecting a warning can
 * highlight it in the grid. Solver params are best-effort: we try the slot id
 * first, then fall back to matching class/day/period, then course.
 */
function resolveHighlightSlotId(
  violation: TimetableViolation | undefined,
  slots: TimetableEditorSlot[],
): string | null {
  if (!violation) return null;
  const params = violation.params ?? {};
  const slotId = params.slotId ?? params.timetableSlotId;
  if (typeof slotId === 'string') {
    const found = slots.find((slot) => slot.id === slotId);
    if (found) return found.id;
  }

  const classId = params.classId;
  const dayOfWeek = params.dayOfWeek;
  const periodNumber = params.periodNumber;
  if (
    typeof classId === 'string' &&
    typeof dayOfWeek === 'number' &&
    typeof periodNumber === 'number'
  ) {
    const found = slots.find(
      (slot) =>
        slot.classId === classId &&
        slot.dayOfWeek === dayOfWeek &&
        slot.periodNumber === periodNumber,
    );
    if (found) return found.id;
  }

  const courseId = params.courseId;
  if (typeof courseId === 'string') {
    const found = slots.find((slot) => slot.courseId === courseId);
    if (found) return found.id;
  }

  const teacherMembershipId = params.teacherMembershipId;
  if (typeof teacherMembershipId === 'string') {
    const found = slots.find(
      (slot) => slot.teacher?.membershipId === teacherMembershipId,
    );
    if (found) return found.id;
  }

  return null;
}

export default function TimetableEditorContainer({
  timetableId,
}: TimetableEditorContainerProps) {
  const allowed = useRequirePermission({
    anyOf: [
      PERMS.timetable.manage,
      PERMS.timetable.generate,
      PERMS.timetable.publish,
    ],
  });

  const router = useRouter();
  const { hasPermission } = usePermission();
  const canManage = hasPermission(PERMS.timetable.manage);
  const canPublish = hasPermission(PERMS.timetable.publish);

  // Detail drives the header; useTimetableStatus polls while GENERATING and
  // invalidates detail/slots once the solver settles.
  const { data: detail, isLoading: isLoadingDetail } =
    useTimetable(timetableId);
  useTimetableStatus(timetableId);
  const { data: slots, isLoading: isLoadingSlots } =
    useTimetableSlots(timetableId);

  const moveSlot = useMoveSlot(timetableId);
  const swapSlots = useSwapSlots(timetableId);
  const deleteSlot = useDeleteSlot(timetableId);
  const { mutateAsync: publishTimetable, isPending: isPublishing } =
    usePublishTimetable();
  const { mutateAsync: duplicateTimetable, isPending: isDuplicating } =
    useDuplicateTimetable();

  const showDeleteModal = useShowDeleteModal();
  const showGenerateModal = useShowGenerateTimetableModal();

  // Any in-flight slot edit (move/swap/delete) marks the autosave indicator.
  const pendingEdits = useIsMutating({
    mutationKey: slotMutationKey(timetableId),
  });
  const isSaving = pendingEdits > 0;

  const [selectedViolationIndex, setSelectedViolationIndex] = useState<
    number | null
  >(null);

  const violations = useMemo(() => detail?.violations ?? [], [detail]);
  const highlightSlotId = useMemo(
    () =>
      selectedViolationIndex != null
        ? resolveHighlightSlotId(
            violations[selectedViolationIndex],
            slots ?? [],
          )
        : null,
    [selectedViolationIndex, violations, slots],
  );

  if (!allowed) return null;

  if (isLoadingDetail) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 rounded-lg bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
        <div className="h-96 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 animate-pulse" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
          Timetable not found
        </h3>
        <p className="text-zinc-500 max-w-sm mb-6">
          This timetable version may have been deleted.
        </p>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/academics/timetable">
            <ArrowLeft className="h-4 w-4" /> Back to Studio
          </Link>
        </Button>
      </div>
    );
  }

  const canEdit = detail.status === 'DRAFT' && canManage;

  const handleRegenerate = () => {
    // Re-generate reusing this version's term + template as the modal defaults.
    showGenerateModal({
      academicTermId: detail.academicTermId,
      periodTemplateId: detail.periodTemplateId,
      name: detail.name,
    });
  };

  const handlePublish = () => {
    showDeleteModal({
      title: 'Publish this timetable?',
      subtitle: `“${detail.name}” (v${detail.version}) will become the live timetable everyone sees. Any currently published version will be archived.`,
      confirmButtonText: 'Publish',
      onConfirm: async () => {
        try {
          await publishTimetable(detail.id);
          toast.success('Timetable published.');
        } catch {
          toast.error('Could not publish the timetable. Please try again.');
        }
      },
    });
  };

  const handleDuplicate = async () => {
    try {
      const copy = await duplicateTimetable(detail.id);
      toast.success('Duplicated as a new draft.');
      router.push(`/academics/timetable/${copy.id}`);
    } catch {
      toast.error('Could not duplicate the timetable. Please try again.');
    }
  };

  const isGenerationState =
    detail.status === 'GENERATING' || detail.status === 'FAILED';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="gap-1.5 -ml-2 mb-2 text-muted-foreground"
        >
          <Link href="/academics/timetable">
            <ArrowLeft className="h-4 w-4" /> Studio
          </Link>
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
                {detail.name}
              </h1>
              <span className="font-mono text-sm text-muted-foreground">
                v{detail.version}
              </span>
              <TimetableStatusBadge status={detail.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {detail.academicTerm?.name ?? 'Academic term'} ·{' '}
              {detail.periodTemplate.name}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {canEdit && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    All changes saved
                  </>
                )}
              </span>
            )}
            {canManage && detail.status !== 'GENERATING' && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleDuplicate}
                disabled={isDuplicating}
              >
                <Copy className="h-4 w-4" /> Duplicate
              </Button>
            )}
            {canPublish &&
              (detail.status === 'DRAFT' || detail.status === 'ARCHIVED') && (
                <Button
                  className="gap-2 shadow-sm"
                  onClick={handlePublish}
                  disabled={isPublishing}
                >
                  <Rocket className="h-4 w-4" />
                  {detail.status === 'ARCHIVED' ? 'Roll back' : 'Publish'}
                </Button>
              )}
          </div>
        </div>
      </div>

      {isGenerationState ? (
        <GenerationProgress
          timetable={detail}
          onRegenerate={
            detail.status === 'FAILED' ? handleRegenerate : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="min-w-0">
            {isLoadingSlots ? (
              <div className="h-96 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 animate-pulse" />
            ) : (
              <MasterGrid
                detail={detail}
                slots={slots ?? []}
                canEdit={canEdit}
                highlightSlotId={highlightSlotId}
                onMove={(variables) => moveSlot.mutate(variables)}
                onSwap={(dto) => swapSlots.mutate(dto)}
                onDeleteSlot={(slot) => deleteSlot.mutate(slot.id)}
              />
            )}
          </div>
          <ViolationsPanel
            violations={violations}
            selectedIndex={selectedViolationIndex}
            onSelect={(_violation, index) =>
              setSelectedViolationIndex((prev) =>
                prev === index ? null : index,
              )
            }
          />
        </div>
      )}
    </div>
  );
}
