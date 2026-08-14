'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// ─── Types ───────────────────────────────────────────────────────────────────

export type LessonPlanStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REVISION_REQUESTED';
export type PlanType = 'WEEKLY' | 'MONTHLY';
export type Methodology =
  | 'Lecture'
  | 'Lab'
  | 'Group Activity'
  | 'Presentation'
  | 'Discussion'
  | 'Project'
  | 'Demonstration'
  | 'Field Trip'
  | 'Self Study';

export interface SyllabusTopic {
  id: string;
  title: string;
  orderIndex: number;
  parentId: string | null;
}

export interface LessonPlanItem {
  id: string;
  orderIndex: number;
  estimatedHours: number;
  methodology: Methodology;
  resources: string | null;
  learningOutcomes: string | null;
  hodComment: string | null;
  syllabusTopic: SyllabusTopic;
}

export interface LessonPlanMember {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface LessonPlanVersionRef {
  id: string;
  version: number;
  status: LessonPlanStatus;
  createdAt?: string;
}

export interface LessonPlan {
  id: string;
  tenantId: string;
  classId: string;
  courseId: string;
  academicTermId: string;
  createdById: string;
  planType: PlanType;
  weekNumber: number | null;
  month: number | null;
  year: number;
  startDate: string;
  endDate: string;
  status: LessonPlanStatus;
  version: number;
  parentVersionId: string | null;
  generalRemarks: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  class: { id: string; name: string };
  course: { id: string; name: string; code: string };
  academicTerm: { id: string; name: string };
  creator: LessonPlanMember;
  reviewer: LessonPlanMember | null;
  items: LessonPlanItem[];
  parentVersion: LessonPlanVersionRef | null;
  childVersions: LessonPlanVersionRef[];
}

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface CreateLessonPlanItemDto {
  syllabusTopicId: string;
  estimatedHours: number;
  methodology: Methodology;
  resources?: string;
  learningOutcomes?: string;
  orderIndex?: number;
}

export interface CreateLessonPlanDto {
  classId: string;
  courseId: string;
  academicTermId: string;
  planType: PlanType;
  weekNumber?: number;
  month?: number;
  year: number;
  startDate: string;
  endDate: string;
  submitImmediately?: boolean;
  items: CreateLessonPlanItemDto[];
}

export interface UpdateLessonPlanDto {
  startDate?: string;
  endDate?: string;
  weekNumber?: number;
  month?: number;
  items?: Partial<CreateLessonPlanItemDto & { id?: string }>[];
}

export interface ReviewLessonPlanDto {
  generalRemarks?: string;
  topicComments?: { itemId: string; comment: string }[];
}

export interface CloneLessonPlanDto {
  classId: string;
  academicTermId: string;
  note?: string;
}

export interface ReviewSummary {
  total: number;
  submitted: number;
  approved: number;
  revisionRequested: number;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export enum LessonPlanQueryKey {
  List = 'lessonPlans:list',
  Detail = 'lessonPlans:detail',
  ReviewSummary = 'lessonPlans:reviewSummary',
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export interface LessonPlanFilters {
  status?: LessonPlanStatus | '';
  academicTermId?: string;
  classId?: string;
  courseId?: string;
}

export function useLessonPlans(filters?: LessonPlanFilters) {
  return useQuery({
    queryKey: [LessonPlanQueryKey.List, filters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters?.status) params.status = filters.status;
      if (filters?.academicTermId) params.academicTermId = filters.academicTermId;
      if (filters?.classId) params.classId = filters.classId;
      if (filters?.courseId) params.courseId = filters.courseId;
      const { data } = await axios.get<LessonPlan[]>('/lesson-plans', { params });
      return data;
    },
  });
}

export function useLessonPlan(id: string, enabled = true) {
  return useQuery({
    queryKey: [LessonPlanQueryKey.Detail, id],
    queryFn: async () => {
      const { data } = await axios.get<LessonPlan>(`/lesson-plans/${id}`);
      return data;
    },
    enabled: enabled && !!id,
  });
}

export function useReviewSummary() {
  return useQuery({
    queryKey: [LessonPlanQueryKey.ReviewSummary],
    queryFn: async () => {
      const { data } = await axios.get<ReviewSummary>('/lesson-plans/review/summary');
      return data;
    },
  });
}

export function useCreateLessonPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateLessonPlanDto) => {
      const { data } = await axios.post<LessonPlan>('/lesson-plans', dto);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [LessonPlanQueryKey.List] });
    },
  });
}

export function useUpdateLessonPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateLessonPlanDto }) => {
      const { data } = await axios.patch<LessonPlan>(`/lesson-plans/${id}`, dto);
      return data;
    },
    onSuccess: (data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: [LessonPlanQueryKey.List] });
      void queryClient.invalidateQueries({ queryKey: [LessonPlanQueryKey.Detail, id] });
    },
  });
}

export function useSubmitLessonPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.post<LessonPlan>(`/lesson-plans/${id}/submit`);
      return data;
    },
    onSuccess: (data, id) => {
      void queryClient.invalidateQueries({ queryKey: [LessonPlanQueryKey.List] });
      void queryClient.invalidateQueries({ queryKey: [LessonPlanQueryKey.Detail, id] });
    },
  });
}

export function useApproveLessonPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: ReviewLessonPlanDto }) => {
      const { data } = await axios.post<LessonPlan>(`/lesson-plans/${id}/approve`, dto);
      return data;
    },
    onSuccess: (data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: [LessonPlanQueryKey.List] });
      void queryClient.invalidateQueries({ queryKey: [LessonPlanQueryKey.Detail, id] });
      void queryClient.invalidateQueries({ queryKey: [LessonPlanQueryKey.ReviewSummary] });
    },
  });
}

export function useRequestRevision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: ReviewLessonPlanDto }) => {
      const { data } = await axios.post<LessonPlan>(`/lesson-plans/${id}/request-revision`, dto);
      return data;
    },
    onSuccess: (data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: [LessonPlanQueryKey.List] });
      void queryClient.invalidateQueries({ queryKey: [LessonPlanQueryKey.Detail, id] });
      void queryClient.invalidateQueries({ queryKey: [LessonPlanQueryKey.ReviewSummary] });
    },
  });
}

export function useResubmitLessonPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.post<LessonPlan>(`/lesson-plans/${id}/resubmit`);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [LessonPlanQueryKey.List] });
    },
  });
}

export function useCloneLessonPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: CloneLessonPlanDto }) => {
      const { data } = await axios.post<LessonPlan>(`/lesson-plans/${id}/clone`, dto);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [LessonPlanQueryKey.List] });
    },
  });
}

export function useDeleteLessonPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.delete<{ message: string }>(`/lesson-plans/${id}`);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [LessonPlanQueryKey.List] });
    },
  });
}

export function useWorkDiaryPrefill(id: string, enabled = false) {
  return useQuery({
    queryKey: ['lessonPlans:workDiaryPrefill', id],
    queryFn: async () => {
      const { data } = await axios.get(`/lesson-plans/${id}/work-diary-prefill`);
      return data;
    },
    enabled: enabled && !!id,
  });
}
