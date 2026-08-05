'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useShowDeleteModal,
  useShowTimetableSubstitutionModal,
} from '@/hooks/use-modal';
import {
  type TimetableSubstitution,
  useDeleteSubstitution,
  useSubstitutions,
} from '@/services/api/requests/timetable-config';
import { format } from 'date-fns';
import { Pencil, Plus, Repeat2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SubstitutionsContainer() {
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const { data: substitutions, isLoading } = useSubstitutions({ date });
  const showSubstitutionModal = useShowTimetableSubstitutionModal();
  const showDeleteModal = useShowDeleteModal();
  const { mutateAsync: deleteSubstitution } = useDeleteSubstitution();

  const handleDelete = (substitution: TimetableSubstitution) => {
    showDeleteModal({
      title: 'Remove this substitution?',
      subtitle: `The covering assignment for ${substitution.slot?.className ?? 'this class'} on ${format(new Date(substitution.date), 'd MMM yyyy')} will be removed.`,
      confirmButtonText: 'Remove',
      onConfirm: async () => {
        try {
          await deleteSubstitution(substitution.id);
          toast.success('Substitution removed.');
        } catch {
          toast.error('Could not remove the substitution. Please try again.');
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Substitutions
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Assign covering teachers for specific dates.
          </p>
        </div>
        <Button
          onClick={() => showSubstitutionModal(null, date)}
          className="gap-2 shrink-0"
        >
          <Plus className="h-4 w-4" /> Record Substitution
        </Button>
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Date
        </span>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-9 w-48"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-12 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 animate-pulse"
            />
          ))}
        </div>
      ) : !substitutions?.length ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-3">
            <Repeat2 className="h-7 w-7 text-primary opacity-80" />
          </div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
            No substitutions for this date
          </h3>
          <p className="text-zinc-500 max-w-sm mb-5 text-sm">
            Record a covering teacher when the regular teacher is away.
          </p>
          <Button
            onClick={() => showSubstitutionModal(null, date)}
            variant="outline"
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Record Substitution
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50 dark:bg-zinc-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                <TableHead>Class</TableHead>
                <TableHead className="w-20">Period</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Regular teacher</TableHead>
                <TableHead>Covered by</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {substitutions.map((substitution) => (
                <TableRow key={substitution.id}>
                  <TableCell className="font-medium text-zinc-900 dark:text-zinc-50">
                    {substitution.slot?.className ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {substitution.slot
                      ? `P${substitution.slot.periodNumber}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {substitution.slot?.courseName ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {substitution.slot?.teacherName ?? 'Unassigned'}
                  </TableCell>
                  <TableCell className="font-medium text-zinc-900 dark:text-zinc-50">
                    {substitution.substituteTeacher?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {substitution.reason || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => showSubstitutionModal(substitution)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 dark:text-red-400"
                        onClick={() => handleDelete(substitution)}
                        title="Remove"
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
