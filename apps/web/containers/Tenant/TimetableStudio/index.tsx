'use client';

import { useEffect, useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { VersionListTable } from '@/components/timetable/studio/VersionListTable';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  useShowDeleteModal,
  useShowGenerateTimetableModal,
} from '@/hooks/use-modal';
import { usePermission } from '@/hooks/use-permission';
import { useRequirePermission } from '@/hooks/use-require-permission';
import { useAcademicTerms } from '@/services/api/requests/academic-terms';
import {
  type TimetableListItem,
  useDeleteTimetable,
  useDuplicateTimetable,
  usePublishTimetable,
  useTimetables,
} from '@/services/api/requests/timetables';
import { CalendarRange, Settings2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { PERMS } from '@repo/permissions';

export default function TimetableStudioContainer() {
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
  const canGenerate = hasPermission(PERMS.timetable.generate);

  const { data: terms, isLoading: isLoadingTerms } = useAcademicTerms();
  const activeTerm = useMemo(() => terms?.find((t) => t.isActive), [terms]);

  const [termId, setTermId] = useState<string>('');
  // Default the term filter to the active term once terms load.
  useEffect(() => {
    if (!termId && activeTerm) setTermId(activeTerm.id);
  }, [termId, activeTerm]);

  const termOptions = useMemo(
    () => (terms ?? []).map((t) => ({ value: t.id, label: t.name })),
    [terms],
  );

  const { data: timetables, isLoading } = useTimetables(
    termId ? { academicTermId: termId } : undefined,
  );

  const showGenerateModal = useShowGenerateTimetableModal();
  const showDeleteModal = useShowDeleteModal();
  const { mutateAsync: publishTimetable } = usePublishTimetable();
  const { mutateAsync: duplicateTimetable } = useDuplicateTimetable();
  const { mutateAsync: deleteTimetable } = useDeleteTimetable();

  const handleOpen = (timetable: TimetableListItem) => {
    router.push(`/academics/timetable/${timetable.id}`);
  };

  const handlePublish = (timetable: TimetableListItem) => {
    const isRollback = timetable.status === 'ARCHIVED';
    showDeleteModal({
      title: isRollback
        ? 'Roll back to this version?'
        : 'Publish this timetable?',
      subtitle: isRollback
        ? `“${timetable.name}” (v${timetable.version}) will become the live timetable and the current published version will be archived.`
        : `“${timetable.name}” (v${timetable.version}) will become the live timetable everyone sees. Any currently published version will be archived.`,
      confirmButtonText: isRollback ? 'Roll back' : 'Publish',
      onConfirm: async () => {
        try {
          await publishTimetable(timetable.id);
          toast.success(
            isRollback ? 'Rolled back successfully.' : 'Timetable published.',
          );
        } catch {
          toast.error('Could not publish the timetable. Please try again.');
        }
      },
    });
  };

  const handleDuplicate = async (timetable: TimetableListItem) => {
    try {
      const copy = await duplicateTimetable(timetable.id);
      toast.success('Duplicated as a new draft.');
      router.push(`/academics/timetable/${copy.id}`);
    } catch {
      toast.error('Could not duplicate the timetable. Please try again.');
    }
  };

  const handleDelete = (timetable: TimetableListItem) => {
    showDeleteModal({
      title: 'Delete this version?',
      subtitle: `“${timetable.name}” (v${timetable.version}) will be permanently deleted. This cannot be undone.`,
      confirmButtonText: 'Delete',
      onConfirm: async () => {
        try {
          await deleteTimetable(timetable.id);
          toast.success('Timetable version deleted.');
        } catch {
          toast.error('Could not delete the timetable. Please try again.');
        }
      },
    });
  };

  const handleGenerate = () => {
    showGenerateModal(termId ? { academicTermId: termId } : null);
  };

  if (!allowed) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <CalendarRange className="h-6 w-6 text-primary" />
            Timetable Studio
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate, review, and publish master timetable versions.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild variant="outline" className="gap-2">
            <a href="/academics/timetable/setup/rooms">
              <Settings2 className="h-4 w-4" />
              Setup
            </a>
          </Button>
          {canGenerate && (
            <Button onClick={handleGenerate} className="gap-2 shadow-sm">
              <Sparkles className="h-4 w-4" />
              Generate Master Timetable
            </Button>
          )}
        </div>
      </div>

      {/* Term filter */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Academic Term
        </span>
        <div className="w-64">
          <SearchableSelect
            options={termOptions}
            value={termId}
            onChange={(value: string) => setTermId(value)}
            placeholder={isLoadingTerms ? 'Loading terms…' : '-- All terms --'}
            disabled={isLoadingTerms}
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 animate-pulse"
            />
          ))}
        </div>
      ) : !timetables?.length ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <CalendarRange className="h-8 w-8 text-primary opacity-80" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
            No timetable versions yet
          </h3>
          <p className="text-zinc-500 max-w-sm mb-6">
            Generate a master timetable to place every lesson without clashes.
            Make sure your rooms, periods, and allocations are set up first.
          </p>
          {canGenerate && (
            <Button
              onClick={handleGenerate}
              variant="outline"
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" /> Generate Master Timetable
            </Button>
          )}
        </div>
      ) : (
        <VersionListTable
          timetables={timetables}
          canManage={canManage}
          canPublish={canPublish}
          onOpen={handleOpen}
          onPublish={handlePublish}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
