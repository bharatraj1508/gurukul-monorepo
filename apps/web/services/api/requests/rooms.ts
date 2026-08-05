'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// Room types mirror ROOM_TYPE in apps/api/src/timetables/timetables.constants.ts.
export type RoomType =
  | 'CLASSROOM'
  | 'SCIENCE_LAB'
  | 'COMPUTER_LAB'
  | 'SPORTS'
  | 'AUDITORIUM'
  | 'OTHER';

export const ROOM_TYPES: RoomType[] = [
  'CLASSROOM',
  'SCIENCE_LAB',
  'COMPUTER_LAB',
  'SPORTS',
  'AUDITORIUM',
  'OTHER',
];

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  CLASSROOM: 'Classroom',
  SCIENCE_LAB: 'Science Lab',
  COMPUTER_LAB: 'Computer Lab',
  SPORTS: 'Sports',
  AUDITORIUM: 'Auditorium',
  OTHER: 'Other',
};

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  capacity: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomDto {
  name: string;
  type: RoomType;
  capacity: number;
}

export interface UpdateRoomDto {
  name?: string;
  type?: RoomType;
  capacity?: number;
}

export enum RoomQueryKey {
  List = 'rooms:list',
}

export function useRooms() {
  return useQuery({
    queryKey: [RoomQueryKey.List],
    queryFn: async () => {
      const { data } = await axios.get<Room[]>('/rooms');
      return data;
    },
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateRoomDto) => {
      const { data } = await axios.post<Room>('/rooms', dto);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [RoomQueryKey.List] });
    },
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateRoomDto }) => {
      const { data } = await axios.patch<Room>(`/rooms/${id}`, dto);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [RoomQueryKey.List] });
    },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.delete<{ message: string }>(`/rooms/${id}`);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [RoomQueryKey.List] });
    },
  });
}
