'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ClassQueryKey } from './classes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE';

export interface AttendanceRecord {
  id: string;
  status: AttendanceStatus;
  remark: string | null;
}

export interface AttendanceSheetRow {
  enrolmentId: string;
  studentProfileId: string;
  rollNumber: string;
  name: string | null;
  attendance: AttendanceRecord | null;
}

export interface AttendanceSheetResponse {
  classId: string;
  className: string;
  date: string;
  totalStudents: number;
  sheet: AttendanceSheetRow[];
}

export interface SaveAttendanceRecord {
  enrolmentId: string;
  status: AttendanceStatus;
  remark?: string;
}

export interface SaveAttendanceRequest {
  date: string;
  records: SaveAttendanceRecord[];
}

export enum AttendanceQueryKey {
  Sheet = 'attendance:sheet',
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAttendanceSheet(
  classId: string,
  date: string,
  enabled = true,
) {
  return useQuery({
    queryKey: [AttendanceQueryKey.Sheet, classId, date],
    queryFn: async () => {
      const { data } = await axios.get<AttendanceSheetResponse>(
        `/classes/${classId}/attendance`,
        {
          params: { date },
        },
      );
      return data;
    },
    enabled: enabled && !!classId && !!date,
  });
}

export function useSaveAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      classId,
      dto,
    }: {
      classId: string;
      dto: SaveAttendanceRequest;
    }) => {
      const { data } = await axios.post<void>(
        `/classes/${classId}/attendance`,
        dto,
      );
      return data;
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [
          AttendanceQueryKey.Sheet,
          variables.classId,
          variables.dto.date,
        ],
      });
      void queryClient.invalidateQueries({
        queryKey: [ClassQueryKey.Detail, variables.classId],
      });
    },
  });
}
