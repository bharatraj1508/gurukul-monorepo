'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export interface ClassCourse {
  id: string;
  name: string;
  code: string;
  credits?: number | null;
}

export interface ClassProgram {
  id: string;
  name: string;
  code: string;
  courses?: ClassCourse[];
}

export interface ClassTerm {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

export interface ClassInstructor {
  id: string;
  membershipId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  isPrimary: boolean;
  assignedAt?: string;
  assignedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  courses: { id: string; name: string; code: string }[];
}

export interface ClassStudent {
  enrolmentId: string;
  studentProfileId: string;
  rollNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string; // ACTIVE, WITHDRAWN, COMPLETED
  enrolledAt: string;
}

export interface Class {
  id: string;
  name: string;
  maxCapacity: number;
  status: string; // ACTIVE, ARCHIVED
  enrolledCount: number;
  program: ClassProgram;
  academicTerm: ClassTerm;
  primaryInstructor: ClassInstructor | null;
  instructors?: ClassInstructor[];
  enrolledStudents?: ClassStudent[];
  attendanceOverview?: {
    present: number;
    absent: number;
    leave: number;
    totalStudents: number;
  };
  averageAttendance?: number | null;
  createdAt: string;
  updatedAt: string;
  creator?: { id: string; firstName: string; lastName: string } | null;
  updater?: { id: string; firstName: string; lastName: string } | null;
}

export interface CreateClassDto {
  programId: string;
  academicTermId: string;
  name?: string;
  maxCapacity: number;
}

export interface UpdateClassDto {
  name?: string;
  maxCapacity?: number;
  status?: string;
  instructorIds?: string[];
  primaryInstructorId?: string;
}

export interface InstructorOption {
  membershipId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
}

export enum ClassQueryKey {
  List = 'classes:list',
  Detail = 'classes:detail',
  Instructors = 'instructors:list',
  Courses = 'courses:list',
}

export function useClasses(params?: {
  term?: string;
  program?: string;
  course?: string;
  instructor?: string;
  section?: string;
}) {
  return useQuery({
    queryKey: [
      ClassQueryKey.List,
      params?.term,
      params?.program,
      params?.course,
      params?.instructor,
      params?.section,
    ],
    queryFn: async () => {
      const { data } = await axios.get<Class[]>('/classes', { params });
      return data;
    },
  });
}

export function useClass(id: string, enabled = true) {
  return useQuery({
    queryKey: [ClassQueryKey.Detail, id],
    queryFn: async () => {
      const { data } = await axios.get<Class>(`/classes/${id}`);
      return data;
    },
    enabled: enabled && !!id,
  });
}

export function useCreateClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateClassDto) => {
      const { data } = await axios.post<Class>('/classes', dto);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ClassQueryKey.List] });
    },
  });
}

export function useUpdateClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateClassDto }) => {
      const { data } = await axios.patch<Class>(`/classes/${id}`, dto);
      return data;
    },
    onSuccess: (data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: [ClassQueryKey.List] });
      void queryClient.invalidateQueries({
        queryKey: [ClassQueryKey.Detail, id],
      });
    },
  });
}

export function useArchiveClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.post<Class>(`/classes/${id}/archive`);
      return data;
    },
    onSuccess: (data, id) => {
      void queryClient.invalidateQueries({ queryKey: [ClassQueryKey.List] });
      void queryClient.invalidateQueries({
        queryKey: [ClassQueryKey.Detail, id],
      });
    },
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.delete<{ message: string }>(
        `/classes/${id}`,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ClassQueryKey.List] });
    },
  });
}

export function useInstructors() {
  return useQuery({
    queryKey: [ClassQueryKey.Instructors],
    queryFn: async () => {
      const { data } = await axios.get<InstructorOption[]>('/instructors');
      return data;
    },
  });
}

export function useCourses(params?: { programId?: string }) {
  return useQuery({
    queryKey: [ClassQueryKey.Courses, params?.programId],
    queryFn: async () => {
      const { data } = await axios.get<ClassCourse[]>('/courses', { params });
      return data;
    },
  });
}
