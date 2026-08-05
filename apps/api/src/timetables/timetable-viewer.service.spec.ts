import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from 'nestjs-prisma';

import { TimetableViewerService } from './timetable-viewer.service';

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';

const templateWithBreaks = {
  workingDays: [1, 2],
  slots: [
    {
      sortOrder: 0,
      kind: 'ASSEMBLY',
      label: 'Assembly',
      startTime: '07:45',
      endTime: '08:00',
      periodNumber: null,
    },
    {
      sortOrder: 1,
      kind: 'PERIOD',
      label: null,
      startTime: '08:00',
      endTime: '08:45',
      periodNumber: 1,
    },
    {
      sortOrder: 2,
      kind: 'BREAK',
      label: 'Break',
      startTime: '08:45',
      endTime: '09:00',
      periodNumber: null,
    },
  ],
};

const publishedTimetable = {
  id: 'tt-1',
  name: 'Published',
  publishedAt: new Date('2026-01-01'),
  periodTemplate: templateWithBreaks,
};

describe('TimetableViewerService', () => {
  let service: TimetableViewerService;
  let prisma: {
    tenantMembership: { findFirst: jest.Mock };
    studentProfile: { findFirst: jest.Mock };
    parentProfile: { findFirst: jest.Mock };
    studentParent: { findFirst: jest.Mock; findMany: jest.Mock };
    enrolment: { findFirst: jest.Mock };
    class: { findFirst: jest.Mock };
    classInstructor: { count: jest.Mock };
    timetable: { findFirst: jest.Mock };
    timetableSlot: { findFirst: jest.Mock; findMany: jest.Mock };
    timetableSubstitution: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      tenantMembership: {
        findFirst: jest.fn().mockResolvedValue({ id: 'mem-1' }),
      },
      studentProfile: { findFirst: jest.fn().mockResolvedValue(null) },
      parentProfile: { findFirst: jest.fn().mockResolvedValue(null) },
      studentParent: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      enrolment: { findFirst: jest.fn().mockResolvedValue(null) },
      class: { findFirst: jest.fn().mockResolvedValue(null) },
      classInstructor: { count: jest.fn().mockResolvedValue(0) },
      timetable: { findFirst: jest.fn().mockResolvedValue(null) },
      timetableSlot: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      timetableSubstitution: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableViewerService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(TimetableViewerService);
  });

  describe('getViewerContext', () => {
    it('reports empty personas for a non-member', async () => {
      prisma.tenantMembership.findFirst.mockResolvedValue(null);

      const ctx = await service.getViewerContext(TENANT_ID, USER_ID);

      expect(ctx.personas).toEqual({
        isStudent: false,
        isTeacher: false,
        isParent: false,
      });
      expect(ctx.children).toEqual([]);
    });

    it('resolves personas and parent children', async () => {
      prisma.studentProfile.findFirst.mockResolvedValue({ id: 'stu-1' });
      prisma.classInstructor.count.mockResolvedValue(2);
      prisma.parentProfile.findFirst.mockResolvedValue({ id: 'par-1' });
      prisma.studentParent.findMany.mockResolvedValue([
        {
          student: {
            id: 'child-1',
            rollNumber: 'R1',
            membership: { user: { firstName: 'Kid', lastName: 'One' } },
            enrolments: [{ class: { name: '5-A' } }],
          },
        },
      ]);

      const ctx = await service.getViewerContext(TENANT_ID, USER_ID);

      expect(ctx.personas).toEqual({
        isStudent: true,
        isTeacher: true,
        isParent: true,
      });
      expect(ctx.children).toEqual([
        { studentProfileId: 'child-1', name: 'Kid One', className: '5-A' },
      ]);
    });
  });

  describe('getMyTimetable', () => {
    it('404s when the user has no student profile', async () => {
      prisma.studentProfile.findFirst.mockResolvedValue(null);

      await expect(service.getMyTimetable(TENANT_ID, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('404s when the student has no active enrolment', async () => {
      prisma.studentProfile.findFirst.mockResolvedValue({ id: 'stu-1' });
      prisma.enrolment.findFirst.mockResolvedValue(null);

      await expect(service.getMyTimetable(TENANT_ID, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns a class view including BREAK/ASSEMBLY template rows', async () => {
      prisma.studentProfile.findFirst.mockResolvedValue({ id: 'stu-1' });
      prisma.enrolment.findFirst.mockResolvedValue({
        class: { id: 'class-1', name: '10-A', academicTermId: 'term-1' },
      });
      prisma.timetable.findFirst.mockResolvedValue(publishedTimetable);
      prisma.timetableSlot.findMany.mockResolvedValue([]);

      const view = await service.getMyTimetable(TENANT_ID, USER_ID);

      const kinds = view.periodTemplate.slots.map((s: any) => s.kind);
      expect(kinds).toEqual(expect.arrayContaining(['ASSEMBLY', 'BREAK']));
      expect(view.class).toEqual({ id: 'class-1', name: '10-A' });
    });
  });

  describe('getStudentTimetable (parent access)', () => {
    it('forbids a user without a parent profile', async () => {
      prisma.parentProfile.findFirst.mockResolvedValue(null);

      await expect(
        service.getStudentTimetable(TENANT_ID, USER_ID, 'child-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('forbids requesting an unlinked child', async () => {
      prisma.parentProfile.findFirst.mockResolvedValue({ id: 'par-1' });
      prisma.studentParent.findFirst.mockResolvedValue(null);

      await expect(
        service.getStudentTimetable(TENANT_ID, USER_ID, 'child-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns a view for a linked child', async () => {
      prisma.parentProfile.findFirst.mockResolvedValue({ id: 'par-1' });
      prisma.studentParent.findFirst.mockResolvedValue({
        studentProfileId: 'child-1',
      });
      prisma.studentProfile.findFirst.mockResolvedValue({ id: 'child-1' });
      prisma.enrolment.findFirst.mockResolvedValue({
        class: { id: 'class-1', name: '10-A', academicTermId: 'term-1' },
      });
      prisma.timetable.findFirst.mockResolvedValue(publishedTimetable);

      const view = await service.getStudentTimetable(
        TENANT_ID,
        USER_ID,
        'child-1',
      );

      expect(view.class).toEqual({ id: 'class-1', name: '10-A' });
    });
  });

  describe('getClassTimetable', () => {
    it('404s for an unknown class', async () => {
      prisma.class.findFirst.mockResolvedValue(null);

      await expect(
        service.getClassTimetable(TENANT_ID, 'class-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('404s when no timetable is published for the term', async () => {
      prisma.class.findFirst.mockResolvedValue({
        id: 'class-1',
        name: '10-A',
        academicTermId: 'term-1',
      });
      prisma.timetable.findFirst.mockResolvedValue(null);

      await expect(
        service.getClassTimetable(TENANT_ID, 'class-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMyTeacherTimetable', () => {
    it('merges own slots with substitutions the teacher covers', async () => {
      // Teacher has an own slot on a published timetable.
      prisma.timetableSlot.findFirst.mockResolvedValue({
        timetableId: 'tt-1',
      });
      prisma.timetable.findFirst.mockResolvedValue(publishedTimetable);
      prisma.timetableSlot.findMany.mockResolvedValue([
        {
          id: 'own-slot',
          classId: 'class-1',
          dayOfWeek: 1,
          periodNumber: 1,
          class: { id: 'class-1', name: '10-A' },
          course: { id: 'c-1', name: 'Math' },
          teacher: { id: 'mem-1', user: { firstName: 'Ada', lastName: 'L' } },
          room: null,
        },
      ]);
      // subsOut (someone covers me) empty; subsIn (I cover others) has one.
      prisma.timetableSubstitution.findMany
        .mockResolvedValueOnce([]) // subsOut
        .mockResolvedValueOnce([
          {
            date: new Date('2026-01-05'),
            reason: 'Sick',
            slot: {
              id: 'covered-slot',
              classId: 'class-2',
              dayOfWeek: 1,
              periodNumber: 1,
              class: { id: 'class-2', name: '9-B' },
              course: { id: 'c-2', name: 'Science' },
              teacher: null,
              room: null,
            },
            substitute: {
              id: 'mem-1',
              user: { firstName: 'Ada', lastName: 'L' },
            },
          },
        ]); // subsIn

      const view = await service.getMyTeacherTimetable(
        TENANT_ID,
        USER_ID,
        '2026-01-05',
      );

      const day1 = view.days.find((d: any) => d.dayOfWeek === 1);
      const substituteIn = day1?.entries.find((e: any) => e.substituteIn);
      expect(substituteIn).toBeDefined();
      expect(substituteIn?.substitution?.teacherName).toBe('Ada L');
      // Own lesson is present too.
      expect(day1?.entries.some((e: any) => e.slotId === 'own-slot')).toBe(
        true,
      );
    });

    it('404s when nothing has ever been published', async () => {
      prisma.timetableSlot.findFirst.mockResolvedValue(null); // no own slot
      prisma.timetable.findFirst.mockResolvedValue(null); // no latest published

      await expect(
        service.getMyTeacherTimetable(TENANT_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
