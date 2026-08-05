import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from 'nestjs-prisma';

import { SubstitutionsService } from './substitutions.service';

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';

// 2026-01-05 is a Monday (ISO weekday 1).
const MONDAY = '2026-01-05';
const TUESDAY = '2026-01-06';

const publishedSlot = {
  id: 'slot-1',
  timetableId: 'tt-1',
  dayOfWeek: 1, // Monday
  periodNumber: 3,
  teacherMembershipId: 'teacher-1',
  timetable: { id: 'tt-1', status: 'PUBLISHED', deletedAt: null },
};

const createdRow = {
  id: 'sub-1',
  timetableSlotId: 'slot-1',
  date: new Date(`${MONDAY}T00:00:00.000Z`),
  reason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  slot: {
    classId: 'class-1',
    dayOfWeek: 1,
    periodNumber: 3,
    class: { id: 'class-1', name: '10-A' },
    course: { id: 'c-1', name: 'Math' },
    teacher: { id: 'teacher-1', user: { firstName: 'Ada', lastName: 'L' } },
  },
  substitute: { id: 'sub-teacher', user: { firstName: 'Bob', lastName: 'M' } },
};

describe('SubstitutionsService', () => {
  let service: SubstitutionsService;
  let prisma: {
    timetableSubstitution: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    timetableSlot: { findFirst: jest.Mock };
    tenantMembership: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      timetableSubstitution: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdRow),
        update: jest.fn().mockResolvedValue(createdRow),
      },
      timetableSlot: { findFirst: jest.fn().mockResolvedValue(null) },
      tenantMembership: {
        findFirst: jest.fn().mockResolvedValue({ id: 'sub-teacher' }),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SubstitutionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(SubstitutionsService);
  });

  const dto = {
    timetableSlotId: 'slot-1',
    date: MONDAY,
    substituteTeacherMembershipId: 'sub-teacher',
  } as any;

  describe('create', () => {
    it('404s when the slot does not exist', async () => {
      prisma.timetableSlot.findFirst.mockResolvedValue(null);

      await expect(service.create(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a slot on a non-published timetable', async () => {
      prisma.timetableSlot.findFirst.mockResolvedValue({
        ...publishedSlot,
        timetable: { id: 'tt-1', status: 'DRAFT', deletedAt: null },
      });

      await expect(service.create(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects when the date weekday does not match the slot day', async () => {
      prisma.timetableSlot.findFirst.mockResolvedValue(publishedSlot);

      await expect(
        service.create(TENANT_ID, USER_ID, { ...dto, date: TUESDAY }),
      ).rejects.toThrow(BadRequestException);
    });

    it('404s when the substitute is not a member', async () => {
      prisma.timetableSlot.findFirst.mockResolvedValue(publishedSlot);
      prisma.tenantMembership.findFirst.mockResolvedValue(null);

      await expect(service.create(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects when the substitute is the lesson teacher', async () => {
      prisma.timetableSlot.findFirst.mockResolvedValue(publishedSlot);
      prisma.tenantMembership.findFirst.mockResolvedValue({ id: 'teacher-1' });

      await expect(
        service.create(TENANT_ID, USER_ID, {
          ...dto,
          substituteTeacherMembershipId: 'teacher-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when the substitute already teaches that period', async () => {
      prisma.timetableSlot.findFirst
        .mockResolvedValueOnce(publishedSlot) // getPublishedSlot
        .mockResolvedValueOnce({ id: 'busy-slot' }); // substitute teaching probe

      await expect(service.create(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects when the substitute already covers another lesson then', async () => {
      prisma.timetableSlot.findFirst
        .mockResolvedValueOnce(publishedSlot)
        .mockResolvedValueOnce(null); // not teaching
      prisma.timetableSubstitution.findFirst.mockResolvedValue({
        id: 'other-sub',
      });

      await expect(service.create(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('maps a duplicate P2002 to a 409', async () => {
      prisma.timetableSlot.findFirst
        .mockResolvedValueOnce(publishedSlot)
        .mockResolvedValueOnce(null);
      prisma.timetableSubstitution.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates on the happy path', async () => {
      prisma.timetableSlot.findFirst
        .mockResolvedValueOnce(publishedSlot)
        .mockResolvedValueOnce(null);

      const result = await service.create(TENANT_ID, USER_ID, dto);

      expect(prisma.timetableSubstitution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            timetableSlotId: 'slot-1',
            substituteTeacherMembershipId: 'sub-teacher',
            createdBy: USER_ID,
          }),
        }),
      );
      expect(result).toMatchObject({ id: 'sub-1', date: MONDAY });
    });
  });

  describe('remove', () => {
    it('404s for an unknown substitution', async () => {
      prisma.timetableSubstitution.findFirst.mockResolvedValue(null);

      await expect(service.remove(TENANT_ID, 'nope', USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('soft deletes', async () => {
      prisma.timetableSubstitution.findFirst.mockResolvedValue({ id: 'sub-1' });

      await service.remove(TENANT_ID, 'sub-1', USER_ID);

      expect(prisma.timetableSubstitution.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { deletedAt: expect.any(Date), updatedBy: USER_ID },
      });
    });
  });
});
