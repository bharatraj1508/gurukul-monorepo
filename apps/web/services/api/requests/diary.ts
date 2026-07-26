'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export interface DiaryRef {
  id: string;
  name: string;
}
export interface DiaryCourseRef {
  id: string;
  name: string;
  code: string;
}

export interface Diary {
  id: string;
  termId: string;
  programId: string;
  classId: string;
  courseId: string | null;
  note: string;
  studentIds: string[];
  createdAt: string;
  updatedAt: string;
  class?: DiaryRef | null;
  course?: DiaryCourseRef | null;
  term?: DiaryRef | null;
  program?: { id: string; name: string; code: string } | null;
  creator?: { id: string; firstName: string; lastName: string } | null;
}

export interface DiaryClassOptionStudent {
  studentProfileId: string;
  firstName: string;
  lastName: string;
  rollNumber: string;
}

export interface DiaryClassOption {
  id: string;
  name: string;
  program: { id: string; name: string; code: string } | null;
  term: { id: string; name: string } | null;
  courses: DiaryCourseRef[];
  students: DiaryClassOptionStudent[];
}

export interface CreateDiaryDto {
  termId: string;
  programId: string;
  classId: string;
  courseId?: string;
  note: string;
  studentIds?: string[];
}

export interface UpdateDiaryDto {
  note?: string;
  courseId?: string | null;
  studentIds?: string[];
}

export enum DiaryQueryKey {
  List = 'diary:list',
  Options = 'diary:options',
}

export function useDiaries(params?: {
  classId?: string;
  termId?: string;
  courseId?: string;
}) {
  return useQuery({
    queryKey: [
      DiaryQueryKey.List,
      params?.classId,
      params?.termId,
      params?.courseId,
    ],
    queryFn: async () => {
      const { data } = await axios.get<Diary[]>('/diary', { params });
      return data;
    },
  });
}

// Classes (with program/term/courses/students) the caller may author notes for.
export function useDiaryOptions(enabled = true) {
  return useQuery({
    queryKey: [DiaryQueryKey.Options],
    queryFn: async () => {
      const { data } = await axios.get<DiaryClassOption[]>('/diary/options');
      return data;
    },
    enabled,
  });
}

export function useCreateDiary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateDiaryDto) => {
      const { data } = await axios.post<Diary>('/diary', dto);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [DiaryQueryKey.List] });
    },
  });
}

export function useUpdateDiary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateDiaryDto }) => {
      const { data } = await axios.patch<Diary>(`/diary/${id}`, dto);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [DiaryQueryKey.List] });
    },
  });
}

export function useDeleteDiary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.delete<{ message?: string }>(`/diary/${id}`);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [DiaryQueryKey.List] });
    },
  });
}
