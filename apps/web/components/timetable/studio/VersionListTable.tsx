'use client';

import { TimetableStatusBadge } from '@/components/timetable/studio/TimetableStatusBadge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { TimetableListItem } from '@/services/api/requests/timetables';
import { format } from 'date-fns';
import {
  Copy,
  ExternalLink,
  MoreVertical,
  Rocket,
  Trash2,
  Undo2,
} from 'lucide-react';

export interface VersionListTableProps {
  timetables: TimetableListItem[];
  canManage: boolean;
  canPublish: boolean;
  onOpen: (timetable: TimetableListItem) => void;
  onPublish: (timetable: TimetableListItem) => void;
  onDuplicate: (timetable: TimetableListItem) => void;
  onDelete: (timetable: TimetableListItem) => void;
}

export function VersionListTable({
  timetables,
  canManage,
  canPublish,
  onOpen,
  onPublish,
  onDuplicate,
  onDelete,
}: VersionListTableProps) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-zinc-50 dark:bg-zinc-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
            <TableHead className="w-20">Version</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="w-32">Status</TableHead>
            <TableHead className="w-40">Updated</TableHead>
            <TableHead className="w-40">Published</TableHead>
            <TableHead className="w-12 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {timetables.map((timetable) => {
            const canPublishThis =
              canPublish &&
              (timetable.status === 'DRAFT' || timetable.status === 'ARCHIVED');
            const canDeleteThis = canManage && timetable.status !== 'PUBLISHED';
            return (
              <TableRow
                key={timetable.id}
                onClick={() => onOpen(timetable)}
                className="cursor-pointer"
              >
                <TableCell className="font-mono text-muted-foreground">
                  v{timetable.version}
                </TableCell>
                <TableCell className="font-medium text-zinc-900 dark:text-zinc-50">
                  {timetable.name}
                </TableCell>
                <TableCell>
                  <TimetableStatusBadge status={timetable.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(timetable.updatedAt), 'd MMM yyyy, HH:mm')}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {timetable.publishedAt
                    ? format(new Date(timetable.publishedAt), 'd MMM yyyy')
                    : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => onOpen(timetable)}>
                        <ExternalLink className="h-4 w-4 mr-2" /> Open
                      </DropdownMenuItem>
                      {canPublishThis && (
                        <DropdownMenuItem onClick={() => onPublish(timetable)}>
                          {timetable.status === 'ARCHIVED' ? (
                            <>
                              <Undo2 className="h-4 w-4 mr-2" /> Roll back to
                              this
                            </>
                          ) : (
                            <>
                              <Rocket className="h-4 w-4 mr-2" /> Publish
                            </>
                          )}
                        </DropdownMenuItem>
                      )}
                      {canManage && timetable.status !== 'GENERATING' && (
                        <DropdownMenuItem
                          onClick={() => onDuplicate(timetable)}
                        >
                          <Copy className="h-4 w-4 mr-2" /> Duplicate
                        </DropdownMenuItem>
                      )}
                      {canDeleteThis && (
                        <DropdownMenuItem
                          onClick={() => onDelete(timetable)}
                          className="text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
