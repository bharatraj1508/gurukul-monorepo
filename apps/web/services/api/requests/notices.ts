'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export type NoticeScope = 'CLASS' | 'TEACHERS_ONLY' | 'SCHOOL_WIDE';

export interface NoticeClass {
  classId: string;
  class: { id: string; name: string; program: { id: string; name: string; code: string } };
}

export interface NoticeCreator {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Notice {
  id: string;
  tenantId: string;
  title: string;
  content: string; // HTML
  scope: NoticeScope;
  startDate: string; // ISO
  endDate: string; // ISO
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  classes: NoticeClass[];
  creator: NoticeCreator | null;
}

export interface CreateNoticeDto {
  title: string;
  content: string;
  scope: NoticeScope;
  sendImmediately: boolean;
  startDate?: string;
  endDate: string;
  classIds?: string[];
}

export interface UpdateNoticeDto {
  title?: string;
  content?: string;
  scope?: NoticeScope;
  startDate?: string;
  endDate?: string;
  classIds?: string[];
}

export enum NoticeQueryKey {
  List = 'notices:list',
  Detail = 'notices:detail',
}

export function useNotices(params?: { scope?: string; classId?: string; active?: string }) {
  return useQuery({
    queryKey: [NoticeQueryKey.List, params?.scope, params?.classId, params?.active],
    queryFn: async () => {
      const { data } = await axios.get<Notice[]>('/notices', { params });
      return data;
    },
  });
}

export function useNotice(id: string, enabled = true) {
  return useQuery({
    queryKey: [NoticeQueryKey.Detail, id],
    queryFn: async () => {
      const { data } = await axios.get<Notice>(`/notices/${id}`);
      return data;
    },
    enabled: enabled && !!id,
  });
}

export function useCreateNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateNoticeDto) => {
      const { data } = await axios.post<Notice>('/notices', dto);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [NoticeQueryKey.List] });
    },
  });
}

export function useUpdateNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateNoticeDto }) => {
      const { data } = await axios.patch<Notice>(`/notices/${id}`, dto);
      return data;
    },
    onSuccess: (data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: [NoticeQueryKey.List] });
      void queryClient.invalidateQueries({ queryKey: [NoticeQueryKey.Detail, id] });
    },
  });
}

export function useDeleteNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.delete<{ message: string }>(`/notices/${id}`);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [NoticeQueryKey.List] });
    },
  });
}
