'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SyllabusTopic {
  id: string;
  courseId: string;
  parentId: string | null;
  title: string;
  orderIndex: number;
  children: SyllabusTopic[];
}

export interface CreateSyllabusTopicDto {
  title: string;
  parentId?: string;
  orderIndex?: number;
}

export interface UpdateSyllabusTopicDto {
  title?: string;
  parentId?: string | null;
  orderIndex?: number;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export enum SyllabusTopicQueryKey {
  List = 'syllabusTopics:list',
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useSyllabusTopics(courseId: string, enabled = true) {
  return useQuery({
    queryKey: [SyllabusTopicQueryKey.List, courseId],
    queryFn: async () => {
      const { data } = await axios.get<SyllabusTopic[]>(
        `/courses/${courseId}/syllabus-topics`,
      );
      return data;
    },
    enabled: enabled && !!courseId,
  });
}

export function useCreateSyllabusTopic(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateSyllabusTopicDto) => {
      const { data } = await axios.post<SyllabusTopic>(
        `/courses/${courseId}/syllabus-topics`,
        dto,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [SyllabusTopicQueryKey.List, courseId],
      });
    },
  });
}

export function useUpdateSyllabusTopic(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateSyllabusTopicDto }) => {
      const { data } = await axios.patch<SyllabusTopic>(
        `/courses/${courseId}/syllabus-topics/${id}`,
        dto,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [SyllabusTopicQueryKey.List, courseId],
      });
    },
  });
}

export function useDeleteSyllabusTopic(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.delete<{ message: string }>(
        `/courses/${courseId}/syllabus-topics/${id}`,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [SyllabusTopicQueryKey.List, courseId],
      });
    },
  });
}
