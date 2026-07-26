'use client';

import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useShowApiError } from '@/hooks/api/use-show-api-error';
import { useShowDeleteModal, useShowDiaryModal } from '@/hooks/use-modal';
import { usePermission } from '@/hooks/use-permission';
import { useSubdomain } from '@/hooks/use-subdomain';
import {
  Diary,
  useDeleteDiary,
  useDiaries,
} from '@/services/api/requests/diary';
import { useCurrentTenant } from '@/services/api/requests/tenants';
import { useCurrentUserProfile } from '@/services/api/requests/users';
import { PERMS } from '@repo/permissions';
import { NotebookPen, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

function WorkDiaryCard() {
  const { hasPermission, hasAnyPermission } = usePermission();
  const showDiaryModal = useShowDiaryModal();
  const showDeleteModal = useShowDeleteModal();
  const showError = useShowApiError();

  const canView = hasAnyPermission([PERMS.diary.view, PERMS.diary.viewOwn]);
  const { data: notes, isLoading } = useDiaries();
  const { mutateAsync: deleteDiary } = useDeleteDiary();

  if (!canView) return null;

  const canCreate = hasPermission(PERMS.diary.create);
  const canEdit = hasPermission(PERMS.diary.edit);
  const canDelete = hasPermission(PERMS.diary.delete);

  const confirmDelete = (note: Diary) =>
    showDeleteModal({
      title: 'Delete diary note',
      subtitle: 'This note will be removed from the work diary.',
      confirmButtonText: 'Delete',
      onConfirm: async () => {
        try {
          await deleteDiary(note.id);
          toast.success('Diary note deleted.');
        } catch (error) {
          showError(error);
        }
      },
    });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <NotebookPen className="h-4 w-4 text-primary" />
          Work Diary
        </CardTitle>
        {canCreate && (
          <Button size="sm" onClick={() => showDiaryModal(null)}>
            <Plus className="mr-1 h-3 w-3" /> New note
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading notes...
          </p>
        ) : !notes || notes.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No diary notes yet.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {notes.map((note) => (
              <li key={note.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">
                      {note.class?.name ?? 'Class'}
                    </Badge>
                    {note.course && (
                      <Badge variant="outline">{note.course.name}</Badge>
                    )}
                    <Badge variant="outline">
                      {note.studentIds.length === 0
                        ? 'All students'
                        : `${note.studentIds.length} student${
                            note.studentIds.length > 1 ? 's' : ''
                          }`}
                    </Badge>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {new Date(note.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="break-words text-sm text-zinc-800 dark:text-zinc-200">
                    {note.note}
                  </p>
                </div>
                {(canEdit || canDelete) && (
                  <div className="flex shrink-0 items-center gap-1">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit note"
                        onClick={() => showDiaryModal(note)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete note"
                        onClick={() => confirmDelete(note)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function TenantDashboard() {
  const { subdomain } = useSubdomain();
  const { data: tenant } = useCurrentTenant();
  const { data: profile } = useCurrentUserProfile();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome back{profile ? `, ${profile.firstName}` : ''}!
          </h1>
          <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Managing workspace:{' '}
          <span className="font-semibold text-primary">
            {tenant?.name || subdomain || 'gurukul'}
          </span>
        </p>
      </div>

      <WorkDiaryCard />
    </div>
  );
}
