'use client';

import { useMemo } from 'react';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useShowCourseModal } from '@/hooks/use-modal';
import { usePermission } from '@/hooks/use-permission';
import { useRequirePermission } from '@/hooks/use-require-permission';
import { useCourse } from '@/services/api/requests/courses';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Edit,
  GraduationCap,
  Info,
  Loader2,
  School,
  Users,
} from 'lucide-react';

import { PERMS } from '@repo/permissions';

interface TenantCourseDetailContainerProps {
  courseId: string;
}

interface ProgramSection {
  id: string;
  name: string;
  status: string;
  academicTerm?: {
    name: string;
  };
}

export default function TenantCourseDetailContainer({
  courseId,
}: TenantCourseDetailContainerProps) {
  const allowed = useRequirePermission({
    anyOf: [PERMS.course.view, PERMS.course.viewOwn],
    redirectTo: '/dashboard',
  });

  const { hasPermission } = usePermission();
  const showCourseModal = useShowCourseModal();

  const { data: course, isLoading, isError } = useCourse(courseId);

  // Column definitions for program scheduled sections/classes
  const columns = useMemo<ColumnDef<ProgramSection>[]>(
    () => [
      {
        id: 'name',
        header: 'Section / Class Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold border uppercase">
              <School className="h-3.5 w-3.5" />
            </div>
            <Link
              href={`/academics/classes/${row.original.id}`}
              className="text-xs font-semibold hover:underline text-primary"
            >
              {row.original.name}
            </Link>
          </div>
        ),
      },
      {
        accessorKey: 'academicTerm.name',
        header: 'Academic Term',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-500">
            {row.original.academicTerm?.name || 'N/A'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                status === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-350 dark:border-emerald-900/60'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60'
              }`}
            >
              {status}
            </span>
          );
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: course?.program?.classes || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!allowed) return null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <span className="text-sm">Loading course details...</span>
      </div>
    );
  }

  if (isError || !course) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <p className="text-sm text-red-500 font-semibold mb-4">
          Failed to load course details.
        </p>
        <Button asChild size="sm">
          <Link href="/academics/courses">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Courses
          </Link>
        </Button>
      </div>
    );
  }

  const sections = course.program.classes || [];
  const teachers = course.teachers || [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link
          href="/academics/courses"
          className="hover:text-primary transition-colors"
        >
          Courses
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-zinc-800 dark:text-zinc-200 font-semibold">
          {course.name}
        </span>
      </div>

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="space-y-2 flex items-start gap-4">
          <div className="h-12 w-12 shrink-0 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
            <BookOpen className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {course.name}
              </h1>
              <span className="font-mono text-xs font-extrabold uppercase px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border">
                {course.code}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Offered under the program{' '}
              <span className="font-semibold text-zinc-700 dark:text-zinc-350">
                {course.program.name}
              </span>{' '}
              ({course.program.code}).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/academics/courses/${course.id}/syllabus`}>
              <BookOpen className="mr-2 h-4 w-4" />
              Manage Syllabus
            </Link>
          </Button>
          {hasPermission(PERMS.course.edit) && (
            <Button onClick={() => showCourseModal(course)} size="sm">
              <Edit className="mr-2 h-4 w-4" />
              Edit Course
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Credits Card */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b pb-2 mb-3">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Course Credits
            </span>
            <GraduationCap className="h-4.5 w-4.5 text-zinc-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
              {course.credits !== null ? course.credits : 'N/A'}
            </span>
            <span className="text-zinc-400 text-sm">
              {course.credits !== null
                ? 'Academic Credits'
                : 'Credits Not Specified'}
            </span>
          </div>
          <div className="text-[10px] text-zinc-400 italic mt-4">
            Represents course weighting within the academic program curriculum.
          </div>
        </div>

        {/* Scheduled Sections Counter */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b pb-2 mb-3">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Scheduled Sections
            </span>
            <School className="h-4.5 w-4.5 text-zinc-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
              {sections.length}
            </span>
            <span className="text-zinc-400 text-sm">
              Active Sections/Classes
            </span>
          </div>
          <div className="text-[10px] text-zinc-400 italic mt-4">
            Classes scheduled for this program are studying this course.
          </div>
        </div>

        {/* Audit Details Card */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b pb-2 mb-3">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Audit Metadata
            </span>
            <Info className="h-4.5 w-4.5 text-zinc-400" />
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500 font-medium">Created By:</span>
              <span className="text-zinc-900 dark:text-zinc-50 font-semibold truncate max-w-[120px]">
                {course.creator
                  ? `${course.creator.firstName} ${course.creator.lastName.charAt(0)}.`
                  : 'System'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 font-medium">Created At:</span>
              <span className="text-zinc-900 dark:text-zinc-50 font-semibold">
                {new Date(course.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between border-t border-zinc-100 dark:border-zinc-900 pt-1 mt-1">
              <span className="text-zinc-500 font-medium">Updated By:</span>
              <span className="text-zinc-900 dark:text-zinc-50 font-semibold truncate max-w-[120px]">
                {course.updater
                  ? `${course.updater.firstName} ${course.updater.lastName.charAt(0)}.`
                  : 'System'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 font-medium">Updated At:</span>
              <span className="text-zinc-900 dark:text-zinc-50 font-semibold">
                {new Date(course.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Content: Left (Description & Teachers), Right (Sections list) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          {/* Description Card */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2 border-b pb-2">
              <Info className="h-4.5 w-4.5 text-primary shrink-0" />
              Course Description
            </h3>
            <p className="text-xs text-zinc-650 dark:text-zinc-350 leading-relaxed whitespace-pre-line">
              {course.description ||
                'No description provided for this course subject.'}
            </p>
          </div>

          {/* Teachers Card */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2 border-b pb-2">
              <Users className="h-4.5 w-4.5 text-primary shrink-0" />
              Teachers ({teachers.length})
            </h3>
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {teachers.length === 0 ? (
                <span className="text-xs text-muted-foreground italic block py-4 text-center">
                  No teachers assigned to this course yet.
                </span>
              ) : (
                teachers.map((teacher) => (
                  <div
                    key={`${teacher.membershipId}-${teacher.classId}`}
                    className="flex items-center gap-2.5 p-2 rounded-lg border hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors overflow-hidden"
                  >
                    <div className="h-7 w-7 rounded-full bg-zinc-100 dark:bg-zinc-800 border flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                      {teacher.firstName.charAt(0)}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-150 truncate">
                        {teacher.firstName} {teacher.lastName}
                      </span>
                      <span className="text-[9px] text-zinc-400 truncate">
                        {teacher.email}
                      </span>
                      <Link
                        href={`/academics/classes/${teacher.classId}`}
                        className="text-[9px] text-primary hover:underline truncate"
                      >
                        {teacher.className}
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Program Scheduled Classes Card */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2 border-b pb-2">
              <School className="h-4.5 w-4.5 text-primary shrink-0" />
              Scheduled Sections / Classes ({sections.length})
            </h3>

            {sections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center">
                <School className="h-8 w-8 text-zinc-300 dark:text-zinc-700 mb-2" />
                <span className="text-xs font-semibold">
                  No sections scheduled
                </span>
                <span className="text-[10px] text-zinc-400 mt-0.5">
                  Scheduled sections will automatically display here based on
                  program classes.
                </span>
              </div>
            ) : (
              <div className="overflow-hidden border border-zinc-200 dark:border-zinc-800 rounded-lg max-h-96 overflow-y-auto">
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
                          <TableCell key={cell.id}>
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
    </div>
  );
}
