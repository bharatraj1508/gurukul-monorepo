import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from 'nestjs-prisma';

import { TimetableEditorService } from './timetable-editor.service';

const TENANT_ID = 'tenant-1';
const TIMETABLE_ID = 'tt-1';

const draftTimetable = {
  id: TIMETABLE_ID,
  tenantId: TENANT_ID,
  status: 'DRAFT',
  periodTemplate: {
    workingDays: [1, 2, 3, 4, 5],
    slots: [
      { kind: 'PERIOD', periodNumber: 1 },
      { kind: 'PERIOD', periodNumber: 2 },
      { kind: 'BREAK', periodNumber: null },
    ],
  },
};

const baseSlot = {
  id: 'slot-1',
  tenantId: TENANT_ID,
  timetableId: TIMETABLE_ID,
  classId: 'class-1',
  courseId: 'course-1',
  teacherMembershipId: 'teacher-1',
  roomId: 'room-1',
  dayOfWeek: 1,
  periodNumber: 1,
};

const conflictingSlot = (overrides: Record<string, unknown> = {}) => ({
  id: 'slot-x',
  classId: 'class-9',
  dayOfWeek: 2,
  periodNumber: 2,
  class: { name: 'Class 9' },
  course: { name: 'History' },
  ...overrides,
});

describe('TimetableEditorService', () => {
  let service: TimetableEditorService;
  let prisma: {
    timetable: { findFirst: jest.Mock };
    timetableSlot: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    teacherConstraint: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      timetable: {
        findFirst: jest.fn().mockResolvedValue(draftTimetable),
      },
      timetableSlot: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({ id: 'slot-1' }),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      teacherConstraint: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableEditorService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(TimetableEditorService);
  });

  const move = (dto: any = { dayOfWeek: 2, periodNumber: 2 }) =>
    service.moveSlot(TENANT_ID, TIMETABLE_ID, 'slot-1', dto);

  describe('getEditableTimetable guards', () => {
    it('404s for an unknown timetable', async () => {
      prisma.timetable.findFirst.mockResolvedValue(null);

      await expect(move()).rejects.toThrow(NotFoundException);
    });

    it('rejects a non-DRAFT timetable', async () => {
      prisma.timetable.findFirst.mockResolvedValue({
        ...draftTimetable,
        status: 'PUBLISHED',
      });

      await expect(move()).rejects.toThrow(ConflictException);
    });

    it('404s when the slot is not in the timetable', async () => {
      prisma.timetableSlot.findFirst.mockResolvedValue(null);

      await expect(move()).rejects.toThrow(NotFoundException);
    });
  });

  describe('moveSlot — happy path', () => {
    it('moves the slot to the target cell with no conflicts', async () => {
      prisma.timetableSlot.findFirst.mockResolvedValueOnce(baseSlot); // slot lookup
      // collectConflicts: class, teacher, room probes all clear
      prisma.timetableSlot.findFirst.mockResolvedValue(null);

      await move({ dayOfWeek: 2, periodNumber: 2 });

      expect(prisma.timetableSlot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'slot-1' },
          data: expect.objectContaining({ dayOfWeek: 2, periodNumber: 2 }),
        }),
      );
    });
  });

  describe('moveSlot — grid validation', () => {
    it('returns INVALID_PERIOD for a cell outside the grid', async () => {
      prisma.timetableSlot.findFirst.mockResolvedValueOnce(baseSlot);

      await expect(
        move({ dayOfWeek: 6, periodNumber: 1 }),
      ).rejects.toMatchObject({
        response: {
          conflicts: [expect.objectContaining({ code: 'INVALID_PERIOD' })],
        },
      });
    });
  });

  describe('moveSlot — collision codes', () => {
    it('returns CLASS_BUSY when the class already has a lesson', async () => {
      prisma.timetableSlot.findFirst.mockResolvedValueOnce(baseSlot); // slot lookup
      prisma.timetableSlot.findFirst.mockResolvedValueOnce(
        conflictingSlot(), // class clash
      );

      await expect(move()).rejects.toMatchObject({
        response: {
          conflicts: expect.arrayContaining([
            expect.objectContaining({ code: 'CLASS_BUSY' }),
          ]),
        },
      });
    });

    it('returns TEACHER_BUSY when the teacher is occupied', async () => {
      prisma.timetableSlot.findFirst.mockResolvedValueOnce(baseSlot); // slot lookup
      prisma.timetableSlot.findFirst
        .mockResolvedValueOnce(null) // class clear
        .mockResolvedValueOnce(conflictingSlot()); // teacher clash

      await expect(move()).rejects.toMatchObject({
        response: {
          conflicts: expect.arrayContaining([
            expect.objectContaining({ code: 'TEACHER_BUSY' }),
          ]),
        },
      });
    });

    it('returns TEACHER_UNAVAILABLE from a constraint availability gap', async () => {
      prisma.timetableSlot.findFirst.mockResolvedValueOnce(baseSlot); // slot lookup
      prisma.timetableSlot.findFirst
        .mockResolvedValueOnce(null) // class clear
        .mockResolvedValueOnce(null); // teacher clear
      // availability allows period 1 on day 2, but not the requested period 2.
      prisma.teacherConstraint.findFirst.mockResolvedValue({
        availability: { '2': [1] },
      });

      await expect(
        move({ dayOfWeek: 2, periodNumber: 2 }),
      ).rejects.toMatchObject({
        response: {
          conflicts: expect.arrayContaining([
            expect.objectContaining({ code: 'TEACHER_UNAVAILABLE' }),
          ]),
        },
      });
    });

    it('returns ROOM_BUSY when the room is occupied', async () => {
      prisma.timetableSlot.findFirst.mockResolvedValueOnce(baseSlot); // slot lookup
      prisma.timetableSlot.findFirst
        .mockResolvedValueOnce(null) // class clear
        .mockResolvedValueOnce(null) // teacher clear
        .mockResolvedValueOnce(conflictingSlot()); // room clash

      await expect(move()).rejects.toMatchObject({
        response: {
          conflicts: expect.arrayContaining([
            expect.objectContaining({ code: 'ROOM_BUSY' }),
          ]),
        },
      });
    });
  });

  describe('moveSlot — raced P2002', () => {
    it('maps a unique violation to a structured 409', async () => {
      prisma.timetableSlot.findFirst.mockResolvedValueOnce(baseSlot); // slot lookup
      prisma.timetableSlot.findFirst.mockResolvedValue(null); // no logical conflicts
      prisma.timetableSlot.update.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['teacherMembershipId', 'dayOfWeek'] },
      });

      await expect(move()).rejects.toMatchObject({
        response: {
          conflicts: expect.arrayContaining([
            expect.objectContaining({ code: 'TEACHER_BUSY' }),
          ]),
        },
      });
    });
  });

  describe('deleteSlot', () => {
    it('404s when the slot is missing', async () => {
      prisma.timetableSlot.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteSlot(TENANT_ID, TIMETABLE_ID, 'slot-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes the slot', async () => {
      prisma.timetableSlot.findFirst.mockResolvedValue({ id: 'slot-1' });

      await service.deleteSlot(TENANT_ID, TIMETABLE_ID, 'slot-1');

      expect(prisma.timetableSlot.delete).toHaveBeenCalledWith({
        where: { id: 'slot-1' },
      });
    });
  });
});
