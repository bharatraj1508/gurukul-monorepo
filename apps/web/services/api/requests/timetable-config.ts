'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

import type { RoomType } from './rooms';

// ---------------------------------------------------------------------------
// Types in this file are the pinned FE contract for the timetable config API
// (period templates, course allocations, teacher constraints, substitutions).
// Kinds mirror PERIOD_SLOT_KIND in apps/api/src/timetables/timetables.constants.ts.
// ---------------------------------------------------------------------------

export type PeriodSlotKind = 'PERIOD' | 'BREAK' | 'ASSEMBLY' | 'LUNCH';

export const PERIOD_SLOT_KINDS: PeriodSlotKind[] = [
  'PERIOD',
  'BREAK',
  'ASSEMBLY',
  'LUNCH',
];

export interface PeriodTemplateSlot {
  id: string;
  sortOrder: number;
  kind: PeriodSlotKind;
  label: string;
  /** "HH:mm" 24h wall-clock times. */
  startTime: string;
  endTime: string;
  /** Sequential 1..n over PERIOD slots only; null for breaks. */
  periodNumber: number | null;
}

export interface PeriodTemplate {
  id: string;
  name: string;
  /** ISO weekdays the school runs, 1=Monday..7=Sunday. */
  workingDays: number[];
  slots: PeriodTemplateSlot[];
  createdAt: string;
  updatedAt: string;
}

export interface PeriodTemplateSlotInput {
  sortOrder: number;
  kind: PeriodSlotKind;
  label: string;
  startTime: string;
  endTime: string;
  periodNumber: number | null;
}

export interface SavePeriodTemplateDto {
  name: string;
  workingDays: number[];
  slots: PeriodTemplateSlotInput[];
}

export interface CourseAllocation {
  id: string;
  classId: string;
  courseId: string;
  periodsPerWeek: number;
  consecutiveBlockSize: number;
  /** Pinned room. Mutually exclusive with roomType; both null = home classroom. */
  roomId: string | null;
  roomType: RoomType | null;
  course?: { id: string; name: string; code: string } | null;
}

export interface CourseAllocationInput {
  courseId: string;
  periodsPerWeek: number;
  consecutiveBlockSize: number;
  roomId?: string | null;
  roomType?: RoomType | null;
}

export interface TeacherConstraint {
  id: string;
  tenantMembershipId: string;
  maxPeriodsPerDay: number | null;
  maxPeriodsPerWeek: number | null;
  maxConsecutivePeriods: number | null;
  /**
   * Allowed period numbers per ISO weekday, e.g. {"1": [1,2,3,8]}.
   * null = fully available.
   */
  availability: Record<string, number[]> | null;
  teacher?: { membershipId: string; name: string; email: string } | null;
}

export interface SaveTeacherConstraintDto {
  maxPeriodsPerDay?: number | null;
  maxPeriodsPerWeek?: number | null;
  maxConsecutivePeriods?: number | null;
  availability?: Record<string, number[]> | null;
}

export interface TimetableSubstitution {
  id: string;
  timetableSlotId: string;
  /** "yyyy-MM-dd". */
  date: string;
  substituteTeacherMembershipId: string;
  reason: string | null;
  slot?: {
    id: string;
    classId: string;
    className: string;
    dayOfWeek: number;
    periodNumber: number;
    courseId: string;
    courseName: string;
    teacherName: string | null;
  } | null;
  substituteTeacher?: { membershipId: string; name: string } | null;
}

export interface CreateSubstitutionDto {
  timetableSlotId: string;
  date: string;
  substituteTeacherMembershipId: string;
  reason?: string;
}

export interface UpdateSubstitutionDto {
  substituteTeacherMembershipId?: string;
  reason?: string;
}

export enum TimetableConfigQueryKey {
  PeriodTemplates = 'period-templates:list',
  CourseAllocations = 'course-allocations:list',
  TeacherConstraints = 'teacher-constraints:list',
  Substitutions = 'timetable-substitutions:list',
}

// ---------------------------------------------------------------------------
// Period templates
// ---------------------------------------------------------------------------

export function usePeriodTemplates() {
  return useQuery({
    queryKey: [TimetableConfigQueryKey.PeriodTemplates],
    queryFn: async () => {
      const { data } = await axios.get<PeriodTemplate[]>('/period-templates');
      return data;
    },
  });
}

export function useCreatePeriodTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: SavePeriodTemplateDto) => {
      const { data } = await axios.post<PeriodTemplate>(
        '/period-templates',
        dto,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [TimetableConfigQueryKey.PeriodTemplates],
      });
    },
  });
}

export function useUpdatePeriodTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      dto,
    }: {
      id: string;
      dto: SavePeriodTemplateDto;
    }) => {
      const { data } = await axios.patch<PeriodTemplate>(
        `/period-templates/${id}`,
        dto,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [TimetableConfigQueryKey.PeriodTemplates],
      });
    },
  });
}

export function useDeletePeriodTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.delete<{ message: string }>(
        `/period-templates/${id}`,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [TimetableConfigQueryKey.PeriodTemplates],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Course allocations (bulk-upserted per class)
// ---------------------------------------------------------------------------

export function useCourseAllocations(classId: string, enabled = true) {
  return useQuery({
    queryKey: [TimetableConfigQueryKey.CourseAllocations, classId],
    queryFn: async () => {
      const { data } = await axios.get<CourseAllocation[]>(
        '/course-allocations',
        { params: { classId } },
      );
      return data;
    },
    enabled: enabled && !!classId,
  });
}

export function useSaveCourseAllocations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      classId,
      allocations,
    }: {
      classId: string;
      allocations: CourseAllocationInput[];
    }) => {
      const { data } = await axios.put<CourseAllocation[]>(
        `/course-allocations/classes/${classId}`,
        { allocations },
      );
      return data;
    },
    onSuccess: (data, { classId }) => {
      void queryClient.invalidateQueries({
        queryKey: [TimetableConfigQueryKey.CourseAllocations, classId],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Teacher constraints
// ---------------------------------------------------------------------------

export function useTeacherConstraints() {
  return useQuery({
    queryKey: [TimetableConfigQueryKey.TeacherConstraints],
    queryFn: async () => {
      const { data } = await axios.get<TeacherConstraint[]>(
        '/teacher-constraints',
      );
      return data;
    },
  });
}

export function useSaveTeacherConstraint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tenantMembershipId,
      dto,
    }: {
      tenantMembershipId: string;
      dto: SaveTeacherConstraintDto;
    }) => {
      const { data } = await axios.put<TeacherConstraint>(
        `/teacher-constraints/${tenantMembershipId}`,
        dto,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [TimetableConfigQueryKey.TeacherConstraints],
      });
    },
  });
}

export function useDeleteTeacherConstraint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tenantMembershipId: string) => {
      const { data } = await axios.delete<{ message: string }>(
        `/teacher-constraints/${tenantMembershipId}`,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [TimetableConfigQueryKey.TeacherConstraints],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Substitutions
// ---------------------------------------------------------------------------

export function useSubstitutions(params?: { date?: string; classId?: string }) {
  return useQuery({
    queryKey: [
      TimetableConfigQueryKey.Substitutions,
      params?.date,
      params?.classId,
    ],
    queryFn: async () => {
      const { data } = await axios.get<TimetableSubstitution[]>(
        '/timetable-substitutions',
        { params },
      );
      return data;
    },
  });
}

export function useCreateSubstitution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateSubstitutionDto) => {
      const { data } = await axios.post<TimetableSubstitution>(
        '/timetable-substitutions',
        dto,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [TimetableConfigQueryKey.Substitutions],
      });
    },
  });
}

export function useUpdateSubstitution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      dto,
    }: {
      id: string;
      dto: UpdateSubstitutionDto;
    }) => {
      const { data } = await axios.patch<TimetableSubstitution>(
        `/timetable-substitutions/${id}`,
        dto,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [TimetableConfigQueryKey.Substitutions],
      });
    },
  });
}

export function useDeleteSubstitution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.delete<{ message: string }>(
        `/timetable-substitutions/${id}`,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [TimetableConfigQueryKey.Substitutions],
      });
    },
  });
}
