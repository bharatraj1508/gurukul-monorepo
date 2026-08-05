'use client';

import { useEffect, useRef } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';

import type { PeriodSlotKind, PeriodTemplateSlot } from './timetable-config';

// ---------------------------------------------------------------------------
// Types in this file are the pinned FE contract for the timetable API.
// Statuses and machine-readable codes mirror
// apps/api/src/timetables/timetables.constants.ts.
// ---------------------------------------------------------------------------

export type TimetableStatus =
  | 'GENERATING'
  | 'DRAFT'
  | 'PUBLISHED'
  | 'ARCHIVED'
  | 'FAILED';

export type SlotConflictCode =
  | 'CLASS_BUSY'
  | 'TEACHER_BUSY'
  | 'ROOM_BUSY'
  | 'TEACHER_UNAVAILABLE'
  | 'INVALID_PERIOD';

export type ViolationCode = 'SUBJECT_NOT_SPREAD' | 'TEACHER_LOAD_IMBALANCE';

export type InfeasibleHintCode =
  | 'TEACHER_OVERLOADED'
  | 'CLASS_OVERALLOCATED'
  | 'ROOM_TYPE_SCARCE'
  | 'AVAILABILITY_CONFLICT'
  | 'BLOCK_SIZE_IMPOSSIBLE'
  | 'GENERATION_INTERRUPTED'
  | 'UNKNOWN';

export type PreflightCode =
  | 'NO_ALLOCATIONS'
  | 'MISSING_INSTRUCTOR'
  | 'AMBIGUOUS_INSTRUCTOR'
  | 'CLASS_OVERALLOCATED'
  | 'TEACHER_OVERLOADED'
  | 'ROOM_TYPE_MISSING'
  | 'BLOCK_SIZE_INVALID';

export interface TimetableViolation {
  code: ViolationCode | string;
  message: string;
  params: Record<string, unknown>;
}

export interface TimetableFailureHint {
  code: InfeasibleHintCode | string;
  message: string;
  params: Record<string, unknown>;
}

export interface PreflightIssue {
  code: PreflightCode | string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  params: Record<string, unknown>;
}

export interface TimetableListItem {
  id: string;
  academicTermId: string;
  periodTemplateId: string;
  name: string;
  version: number;
  status: TimetableStatus;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimetableSolverStats {
  solverStatus: string;
  objectiveValue: number | null;
  wallTimeMs: number;
}

export interface TimetableDetail extends TimetableListItem {
  academicTerm?: { id: string; name: string } | null;
  periodTemplate: {
    id: string;
    name: string;
    workingDays: number[];
    slots: PeriodTemplateSlot[];
  };
  violations: TimetableViolation[];
  failureHints: TimetableFailureHint[];
  solverStats: TimetableSolverStats | null;
}

export interface TimetableEditorSlot {
  id: string;
  timetableId: string;
  classId: string;
  dayOfWeek: number;
  periodNumber: number;
  courseId: string;
  teacherMembershipId: string | null;
  roomId: string | null;
  class: { id: string; name: string };
  course: { id: string; name: string };
  teacher: { membershipId: string; name: string } | null;
  room: { id: string; name: string } | null;
}

export interface SlotConflict {
  code: SlotConflictCode | string;
  message: string;
  conflictingSlot?: TimetableEditorSlot | null;
}

// ---------------------------------------------------------------------------
// Viewer response shape (shared across /timetable/* endpoints).
// ---------------------------------------------------------------------------

export interface TimetableViewTemplateSlot {
  sortOrder: number;
  kind: PeriodSlotKind;
  label: string;
  startTime: string;
  endTime: string;
  periodNumber: number | null;
}

export interface TimetableViewEntry {
  periodNumber: number;
  course: { id: string; name: string };
  teacher: { membershipId: string; name: string } | null;
  room?: { id: string; name: string } | null;
  /** Present on teacher-view entries so the grid can show which class. */
  class?: { id: string; name: string } | null;
  substitution?: { teacherName: string; reason: string | null } | null;
}

export interface TimetableViewDay {
  dayOfWeek: number;
  /** "yyyy-MM-dd" of this weekday within the requested week. */
  date: string;
  entries: TimetableViewEntry[];
}

export interface TimetableViewResponse {
  timetable: { id: string; name: string; publishedAt: string | null };
  periodTemplate: {
    workingDays: number[];
    slots: TimetableViewTemplateSlot[];
  };
  days: TimetableViewDay[];
}

export interface ViewerChild {
  studentProfileId: string;
  name: string;
  className: string | null;
}

export interface ViewerContext {
  personas: { isStudent: boolean; isTeacher: boolean; isParent: boolean };
  children: ViewerChild[];
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface PreflightTimetableDto {
  academicTermId: string;
  periodTemplateId: string;
}

export interface GenerateTimetableDto {
  academicTermId: string;
  periodTemplateId: string;
  name: string;
  timeLimitSeconds?: number;
}

export interface MoveSlotDto {
  dayOfWeek: number;
  periodNumber: number;
  roomId?: string | null;
}

export interface SwapSlotsDto {
  slotIdA: string;
  slotIdB: string;
}

export enum TimetableQueryKey {
  List = 'timetables:list',
  Detail = 'timetables:detail',
  Slots = 'timetables:slots',
  ViewerContext = 'timetable:viewer-context',
  ViewerMe = 'timetable:viewer:me',
  ViewerStudent = 'timetable:viewer:student',
  ViewerTeacher = 'timetable:viewer:teacher',
  ViewerClass = 'timetable:viewer:class',
}

const VIEWER_KEYS = [
  TimetableQueryKey.ViewerMe,
  TimetableQueryKey.ViewerStudent,
  TimetableQueryKey.ViewerTeacher,
  TimetableQueryKey.ViewerClass,
];

// Substitution freshness matters to viewers: keep data for a minute, but
// refetch whenever the tab regains focus.
const VIEWER_QUERY_OPTIONS = {
  staleTime: 60_000,
  refetchOnWindowFocus: true,
} as const;

/** Viewer endpoints 404 when no published timetable exists — treat as empty. */
async function getViewOrNull(
  url: string,
  params?: Record<string, string>,
): Promise<TimetableViewResponse | null> {
  try {
    const { data } = await axios.get<TimetableViewResponse>(url, { params });
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Viewer hooks
// ---------------------------------------------------------------------------

export function useViewerContext() {
  return useQuery({
    queryKey: [TimetableQueryKey.ViewerContext],
    queryFn: async () => {
      const { data } = await axios.get<ViewerContext>(
        '/timetable/viewer-context',
      );
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useMyTimetable(weekStart: string, enabled = true) {
  return useQuery({
    queryKey: [TimetableQueryKey.ViewerMe, weekStart],
    queryFn: () => getViewOrNull('/timetable/me', { weekStart }),
    enabled: enabled && !!weekStart,
    ...VIEWER_QUERY_OPTIONS,
  });
}

export function useStudentTimetable(
  studentProfileId: string,
  weekStart: string,
  enabled = true,
) {
  return useQuery({
    queryKey: [TimetableQueryKey.ViewerStudent, studentProfileId, weekStart],
    queryFn: () =>
      getViewOrNull(`/timetable/students/${studentProfileId}`, { weekStart }),
    enabled: enabled && !!studentProfileId && !!weekStart,
    ...VIEWER_QUERY_OPTIONS,
  });
}

export function useMyTeacherTimetable(weekStart: string, enabled = true) {
  return useQuery({
    queryKey: [TimetableQueryKey.ViewerTeacher, weekStart],
    queryFn: () => getViewOrNull('/timetable/teachers/me', { weekStart }),
    enabled: enabled && !!weekStart,
    ...VIEWER_QUERY_OPTIONS,
  });
}

export function useClassTimetable(
  classId: string,
  weekStart: string,
  enabled = true,
) {
  return useQuery({
    queryKey: [TimetableQueryKey.ViewerClass, classId, weekStart],
    queryFn: () =>
      getViewOrNull(`/timetable/classes/${classId}`, { weekStart }),
    enabled: enabled && !!classId && !!weekStart,
    ...VIEWER_QUERY_OPTIONS,
  });
}

// ---------------------------------------------------------------------------
// Version lifecycle
// ---------------------------------------------------------------------------

export function useTimetables(params?: {
  academicTermId?: string;
  status?: TimetableStatus;
}) {
  return useQuery({
    queryKey: [TimetableQueryKey.List, params?.academicTermId, params?.status],
    queryFn: async () => {
      const { data } = await axios.get<TimetableListItem[]>('/timetables', {
        params,
      });
      return data;
    },
    // Keep the list fresh while a generation job is running.
    refetchInterval: (query) =>
      query.state.data?.some((t) => t.status === 'GENERATING') ? 4000 : false,
  });
}

export function useTimetable(id: string, enabled = true) {
  return useQuery({
    queryKey: [TimetableQueryKey.Detail, id],
    queryFn: async () => {
      const { data } = await axios.get<TimetableDetail>(`/timetables/${id}`);
      return data;
    },
    enabled: enabled && !!id,
  });
}

export function useTimetableSlots(id: string, enabled = true) {
  return useQuery({
    queryKey: [TimetableQueryKey.Slots, id],
    queryFn: async () => {
      const { data } = await axios.get<TimetableEditorSlot[]>(
        `/timetables/${id}/slots`,
      );
      return data;
    },
    enabled: enabled && !!id,
  });
}

/**
 * Polls the timetable detail every 2s while it is GENERATING, then invalidates
 * the detail, slots, and list queries once the solver settles the status.
 */
export function useTimetableStatus(id: string, enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [TimetableQueryKey.Detail, id, 'status'],
    queryFn: async () => {
      const { data } = await axios.get<TimetableDetail>(`/timetables/${id}`);
      return data;
    },
    enabled: enabled && !!id,
    refetchInterval: (q) =>
      q.state.data?.status === 'GENERATING' ? 2000 : false,
  });

  const status = query.data?.status;
  const previousStatus = useRef<TimetableStatus | undefined>(undefined);
  useEffect(() => {
    if (
      previousStatus.current === 'GENERATING' &&
      status &&
      status !== 'GENERATING'
    ) {
      void queryClient.invalidateQueries({
        queryKey: [TimetableQueryKey.Detail, id],
      });
      void queryClient.invalidateQueries({
        queryKey: [TimetableQueryKey.Slots, id],
      });
      void queryClient.invalidateQueries({
        queryKey: [TimetableQueryKey.List],
      });
    }
    previousStatus.current = status;
  }, [status, id, queryClient]);

  return query;
}

/** Extracts structured preflight issues from a 422 generate/preflight error. */
export function extractPreflightIssues(err: unknown): PreflightIssue[] {
  if (axios.isAxiosError(err) && err.response?.status === 422) {
    const body = err.response.data as { issues?: PreflightIssue[] } | undefined;
    if (Array.isArray(body?.issues)) return body.issues;
  }
  return [];
}

export function usePreflightTimetable() {
  return useMutation({
    mutationFn: async (dto: PreflightTimetableDto) => {
      const { data } = await axios.post<{ issues: PreflightIssue[] }>(
        '/timetables/preflight',
        dto,
      );
      return data;
    },
  });
}

export function useGenerateTimetable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: GenerateTimetableDto) => {
      const { data } = await axios.post<{ timetableId: string }>(
        '/timetables/generate',
        dto,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [TimetableQueryKey.List],
      });
    },
  });
}

export function useRenameTimetable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data } = await axios.patch<TimetableListItem>(
        `/timetables/${id}`,
        { name },
      );
      return data;
    },
    onSuccess: (data, { id }) => {
      void queryClient.invalidateQueries({
        queryKey: [TimetableQueryKey.List],
      });
      void queryClient.invalidateQueries({
        queryKey: [TimetableQueryKey.Detail, id],
      });
    },
  });
}

export function useDuplicateTimetable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.post<TimetableListItem>(
        `/timetables/${id}/duplicate`,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [TimetableQueryKey.List],
      });
    },
  });
}

export function useDeleteTimetable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.delete<{ message: string }>(
        `/timetables/${id}`,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [TimetableQueryKey.List],
      });
    },
  });
}

export function usePublishTimetable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.post<TimetableListItem>(
        `/timetables/${id}/publish`,
      );
      return data;
    },
    onSuccess: (data, id) => {
      void queryClient.invalidateQueries({
        queryKey: [TimetableQueryKey.List],
      });
      void queryClient.invalidateQueries({
        queryKey: [TimetableQueryKey.Detail, id],
      });
      void queryClient.invalidateQueries({
        queryKey: [TimetableQueryKey.Slots, id],
      });
      // Everyone's published view just changed.
      for (const key of VIEWER_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Draft editor mutations (optimistic with snapshot/revert)
// ---------------------------------------------------------------------------

/** Extracts structured slot conflicts from a 409 move/swap error body. */
export function extractSlotConflicts(err: unknown): SlotConflict[] {
  if (axios.isAxiosError(err) && err.response?.status === 409) {
    const body = err.response.data as
      | { conflicts?: SlotConflict[] }
      | undefined;
    if (Array.isArray(body?.conflicts)) return body.conflicts;
  }
  return [];
}

function showSlotConflictToast(err: unknown) {
  const conflicts = extractSlotConflicts(err);
  if (conflicts.length > 0) {
    for (const conflict of conflicts) {
      toast.error(conflict.message);
    }
    return;
  }
  toast.error('Could not update the slot. Please try again.');
}

export function slotMutationKey(timetableId: string) {
  return ['timetable-slot-edits', timetableId];
}

export function useMoveSlot(timetableId: string) {
  const queryClient = useQueryClient();
  const slotsKey = [TimetableQueryKey.Slots, timetableId];
  return useMutation({
    mutationKey: slotMutationKey(timetableId),
    mutationFn: async ({
      slotId,
      dto,
    }: {
      slotId: string;
      dto: MoveSlotDto;
    }) => {
      const { data } = await axios.patch<TimetableEditorSlot>(
        `/timetables/${timetableId}/slots/${slotId}`,
        dto,
      );
      return data;
    },
    onMutate: async ({ slotId, dto }) => {
      await queryClient.cancelQueries({ queryKey: slotsKey });
      const previous =
        queryClient.getQueryData<TimetableEditorSlot[]>(slotsKey);
      queryClient.setQueryData<TimetableEditorSlot[]>(slotsKey, (old) =>
        old?.map((slot) =>
          slot.id === slotId
            ? {
                ...slot,
                dayOfWeek: dto.dayOfWeek,
                periodNumber: dto.periodNumber,
                ...(dto.roomId !== undefined ? { roomId: dto.roomId } : {}),
              }
            : slot,
        ),
      );
      return { previous };
    },
    onError: (err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(slotsKey, context.previous);
      }
      showSlotConflictToast(err);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: slotsKey });
      void queryClient.invalidateQueries({
        queryKey: [TimetableQueryKey.Detail, timetableId],
      });
    },
  });
}

export function useSwapSlots(timetableId: string) {
  const queryClient = useQueryClient();
  const slotsKey = [TimetableQueryKey.Slots, timetableId];
  return useMutation({
    mutationKey: slotMutationKey(timetableId),
    mutationFn: async (dto: SwapSlotsDto) => {
      const { data } = await axios.post<TimetableEditorSlot[]>(
        `/timetables/${timetableId}/slots/swap`,
        dto,
      );
      return data;
    },
    onMutate: async ({ slotIdA, slotIdB }) => {
      await queryClient.cancelQueries({ queryKey: slotsKey });
      const previous =
        queryClient.getQueryData<TimetableEditorSlot[]>(slotsKey);
      const a = previous?.find((slot) => slot.id === slotIdA);
      const b = previous?.find((slot) => slot.id === slotIdB);
      if (a && b) {
        queryClient.setQueryData<TimetableEditorSlot[]>(slotsKey, (old) =>
          old?.map((slot) => {
            if (slot.id === a.id) {
              return {
                ...slot,
                dayOfWeek: b.dayOfWeek,
                periodNumber: b.periodNumber,
              };
            }
            if (slot.id === b.id) {
              return {
                ...slot,
                dayOfWeek: a.dayOfWeek,
                periodNumber: a.periodNumber,
              };
            }
            return slot;
          }),
        );
      }
      return { previous };
    },
    onError: (err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(slotsKey, context.previous);
      }
      showSlotConflictToast(err);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: slotsKey });
      void queryClient.invalidateQueries({
        queryKey: [TimetableQueryKey.Detail, timetableId],
      });
    },
  });
}

export function useDeleteSlot(timetableId: string) {
  const queryClient = useQueryClient();
  const slotsKey = [TimetableQueryKey.Slots, timetableId];
  return useMutation({
    mutationKey: slotMutationKey(timetableId),
    mutationFn: async (slotId: string) => {
      const { data } = await axios.delete<{ message: string }>(
        `/timetables/${timetableId}/slots/${slotId}`,
      );
      return data;
    },
    onMutate: async (slotId) => {
      await queryClient.cancelQueries({ queryKey: slotsKey });
      const previous =
        queryClient.getQueryData<TimetableEditorSlot[]>(slotsKey);
      queryClient.setQueryData<TimetableEditorSlot[]>(slotsKey, (old) =>
        old?.filter((slot) => slot.id !== slotId),
      );
      return { previous };
    },
    onError: (err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(slotsKey, context.previous);
      }
      showSlotConflictToast(err);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: slotsKey });
      void queryClient.invalidateQueries({
        queryKey: [TimetableQueryKey.Detail, timetableId],
      });
    },
  });
}
