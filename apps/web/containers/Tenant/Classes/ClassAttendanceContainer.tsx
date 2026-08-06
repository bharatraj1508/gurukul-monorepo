'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/use-permission';
import {
  AttendanceSheetRow,
  AttendanceStatus,
  useAttendanceSheet,
  useSaveAttendance,
} from '@/services/api/requests/attendance';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { AlertCircle, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { PERMS } from '@repo/permissions';

interface ClassAttendanceContainerProps {
  classId: string;
}

interface AttendanceDraft {
  [enrolmentId: string]: {
    status: AttendanceStatus;
    remark: string;
  };
}

export default function ClassAttendanceContainer({
  classId,
}: ClassAttendanceContainerProps) {
  const { hasPermission } = usePermission();
  const canMark = hasPermission(PERMS.attendance.mark);

  const [selectedDate, setSelectedDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]!,
  );
  const [draft, setDraft] = useState<AttendanceDraft>({});
  const [isDirty, setIsDirty] = useState(false);

  const { data, isLoading, isError, refetch } = useAttendanceSheet(
    classId,
    selectedDate,
  );
  const { mutateAsync: saveAttendance, isPending: isSaving } =
    useSaveAttendance();

  // Initialize draft when server data loads
  useEffect(() => {
    if (data?.sheet) {
      const initialDraft: AttendanceDraft = {};
      data.sheet.forEach((row) => {
        initialDraft[row.enrolmentId] = {
          status: row.attendance?.status || 'PRESENT',
          remark: row.attendance?.remark || '',
        };
      });
      setDraft(initialDraft);
      setIsDirty(false);
    }
  }, [data]);

  // Protect against browser refresh / tab close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (!newDate) return;
    if (isDirty) {
      if (
        !window.confirm(
          'You have unsaved changes for the current date. Are you sure you want to change the date and discard them?',
        )
      ) {
        return;
      }
    }
    setSelectedDate(newDate);
  };

  const handleSetToday = () => {
    const today = new Date().toISOString().split('T')[0]!;
    if (today === selectedDate) return;
    if (isDirty) {
      if (
        !window.confirm(
          'You have unsaved changes. Are you sure you want to discard them?',
        )
      ) {
        return;
      }
    }
    setSelectedDate(today);
  };

  const updateDraft = (
    enrolmentId: string,
    field: 'status' | 'remark',
    value: AttendanceStatus | string,
  ) => {
    setDraft((prev) => {
      const current = prev[enrolmentId] || {
        status: 'PRESENT' as AttendanceStatus,
        remark: '',
      };
      return {
        ...prev,
        [enrolmentId]:
          field === 'status'
            ? { ...current, status: value as AttendanceStatus }
            : { ...current, remark: value as string },
      };
    });
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!canMark) return;
    try {
      const records = Object.entries(draft).map(
        ([enrolmentId, { status, remark }]) => ({
          enrolmentId,
          status,
          remark: remark.trim() || undefined,
        }),
      );

      await saveAttendance({
        classId,
        dto: {
          date: selectedDate,
          records,
        },
      });

      toast.success('Attendance saved successfully');
      setIsDirty(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save attendance');
    }
  };

  const columns = useMemo<ColumnDef<AttendanceSheetRow>[]>(
    () => [
      {
        accessorKey: 'rollNumber',
        header: 'Roll No',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold">
            {row.original.rollNumber || '-'}
          </span>
        ),
      },
      {
        id: 'name',
        header: 'Student Name',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {row.original.name || 'Unknown'}
            </span>
          </div>
        ),
      },
      {
        id: 'attendance',
        header: 'Attendance',
        cell: ({ row, table }) => {
          const enrolmentId = row.original.enrolmentId;
          const { draft, updateDraft, canMark, isSaving } = table.options.meta as any;
          const currentStatus = draft[enrolmentId]?.status || 'PRESENT';
          return (
            <div className="flex items-center gap-1">
              <Button
                variant={currentStatus === 'PRESENT' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateDraft(enrolmentId, 'status', 'PRESENT')}
                disabled={!canMark || isSaving}
                className={
                  currentStatus === 'PRESENT'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : ''
                }
              >
                Present
              </Button>
              <Button
                variant={currentStatus === 'ABSENT' ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => updateDraft(enrolmentId, 'status', 'ABSENT')}
                disabled={!canMark || isSaving}
              >
                Absent
              </Button>
              <Button
                variant={currentStatus === 'LEAVE' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => updateDraft(enrolmentId, 'status', 'LEAVE')}
                disabled={!canMark || isSaving}
                className={
                  currentStatus === 'LEAVE'
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : ''
                }
              >
                Leave
              </Button>
            </div>
          );
        },
      },
      {
        id: 'remark',
        header: 'Remark',
        cell: ({ row, table }) => {
          const enrolmentId = row.original.enrolmentId;
          const { draft, updateDraft, canMark, isSaving } = table.options.meta as any;
          return (
            <Input
              value={draft[enrolmentId]?.remark || ''}
              onChange={(e) =>
                updateDraft(enrolmentId, 'remark', e.target.value)
              }
              disabled={!canMark || isSaving}
              placeholder="Optional remark..."
              className="h-9 text-xs"
            />
          );
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: data?.sheet || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      draft,
      updateDraft,
      canMark,
      isSaving,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Attendance Date
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              disabled={isSaving}
              className="w-[150px] h-9"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSetToday}
              disabled={isSaving}
            >
              Today
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-500 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-900/60">
              <AlertCircle className="h-3.5 w-3.5" />
              Unsaved changes
            </span>
          )}
          {canMark && (
            <Button
              onClick={handleSave}
              disabled={!isDirty || isSaving || !data?.sheet.length}
              className="min-w-[140px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Attendance'
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs flex flex-col justify-between">
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 border-b pb-2">
            Attendance Register
            {data && (
              <span className="ml-2 text-xs font-medium text-muted-foreground">
                ({data.totalStudents} students)
              </span>
            )}
          </h3>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
              <span className="text-sm font-semibold text-red-600">
                Failed to load attendance
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-4"
              >
                Retry
              </Button>
            </div>
          ) : !data?.sheet || data.sheet.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center">
              <CalendarIcon className="h-8 w-8 text-zinc-300 dark:text-zinc-700 mb-2" />
              <span className="text-xs font-semibold">
                No students enrolled for this date.
              </span>
              <span className="text-[10px] text-zinc-400 mt-0.5">
                Students enrolled after this date will not appear here.
              </span>
            </div>
          ) : (
            <div className="overflow-hidden border border-zinc-200 dark:border-zinc-800 rounded-lg max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-2.5">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
