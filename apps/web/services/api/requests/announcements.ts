'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export type AnnouncementStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface AnnouncementUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Announcement {
  id: string;
  tenantId: string;
  title: string;
  content: string; // HTML
  status: AnnouncementStatus;
  rejectionReason: string | null;
  approvedAt: string | null;
  approvedById: string | null;
  startDate: string; // ISO
  endDate: string; // ISO
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  creator: AnnouncementUser | null;
  approver: AnnouncementUser | null;
}

export interface CreateAnnouncementDto {
  title: string;
  content: string;
  sendImmediately: boolean;
  startDate?: string;
  endDate: string;
}

export interface UpdateAnnouncementDto {
  title?: string;
  content?: string;
  startDate?: string;
  endDate?: string;
}

export interface RejectAnnouncementDto {
  rejectionReason: string;
}

export enum AnnouncementQueryKey {
  List = 'announcements:list',
  Detail = 'announcements:detail',
}

export function useAnnouncements(params?: { status?: string; active?: string }) {
  return useQuery({
    queryKey: [AnnouncementQueryKey.List, params?.status, params?.active],
    queryFn: async () => {
      const { data } = await axios.get<Announcement[]>('/announcements', { params });
      return data;
    },
  });
}

export function useAnnouncement(id: string, enabled = true) {
  return useQuery({
    queryKey: [AnnouncementQueryKey.Detail, id],
    queryFn: async () => {
      const { data } = await axios.get<Announcement>(`/announcements/${id}`);
      return data;
    },
    enabled: enabled && !!id,
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateAnnouncementDto) => {
      const { data } = await axios.post<Announcement>('/announcements', dto);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [AnnouncementQueryKey.List] });
    },
  });
}

export function useApproveAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.patch<Announcement>(`/announcements/${id}/approve`);
      return data;
    },
    onSuccess: (data, id) => {
      void queryClient.invalidateQueries({ queryKey: [AnnouncementQueryKey.List] });
      void queryClient.invalidateQueries({ queryKey: [AnnouncementQueryKey.Detail, id] });
    },
  });
}

export function useRejectAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: RejectAnnouncementDto }) => {
      const { data } = await axios.patch<Announcement>(`/announcements/${id}/reject`, dto);
      return data;
    },
    onSuccess: (data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: [AnnouncementQueryKey.List] });
      void queryClient.invalidateQueries({ queryKey: [AnnouncementQueryKey.Detail, id] });
    },
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateAnnouncementDto }) => {
      const { data } = await axios.patch<Announcement>(`/announcements/${id}`, dto);
      return data;
    },
    onSuccess: (data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: [AnnouncementQueryKey.List] });
      void queryClient.invalidateQueries({ queryKey: [AnnouncementQueryKey.Detail, id] });
    },
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.delete<{ message: string }>(`/announcements/${id}`);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [AnnouncementQueryKey.List] });
    },
  });
}
