import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { Prisma } from '@prisma/client';
import { PrismaService } from 'nestjs-prisma';

import { TeacherConstraintsService } from './teacher-constraints.service';

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';
const MEMBERSHIP_ID = 'mem-1';

const teacherMembership = {
  id: MEMBERSHIP_ID,
  roles: [{ role: { name: 'Teacher', isSystemRole: true } }],
};

describe('TeacherConstraintsService', () => {
  let service: TeacherConstraintsService;
  let prisma: {
    teacherConstraint: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
    tenantMembership: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      teacherConstraint: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'con-1' }),
        update: jest.fn(),
      },
      tenantMembership: {
        findFirst: jest.fn().mockResolvedValue(teacherMembership),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherConstraintsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(TeacherConstraintsService);
  });

  const upsert = (dto: any) =>
    service.upsert(TENANT_ID, MEMBERSHIP_ID, USER_ID, dto);

  describe('upsert — teacher role guard', () => {
    it('404s when the membership does not exist', async () => {
      prisma.tenantMembership.findFirst.mockResolvedValue(null);

      await expect(upsert({})).rejects.toThrow(NotFoundException);
    });

    it('rejects a membership that lacks the system Teacher role', async () => {
      prisma.tenantMembership.findFirst.mockResolvedValue({
        id: MEMBERSHIP_ID,
        roles: [{ role: { name: 'Teacher', isSystemRole: false } }],
      });

      await expect(upsert({})).rejects.toThrow(BadRequestException);
    });

    it('queries the membership with the system-role filter shape', async () => {
      await upsert({});

      expect(prisma.tenantMembership.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: MEMBERSHIP_ID,
            tenantId: TENANT_ID,
            deletedAt: null,
          }),
        }),
      );
    });
  });

  describe('upsert — availability validation', () => {
    it('rejects availability keys outside ISO weekdays 1-7', async () => {
      await expect(upsert({ availability: { '8': [1] } })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects non-positive period numbers', async () => {
      await expect(upsert({ availability: { '1': [0] } })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('upsert — happy path', () => {
    it('upserts with caps and availability', async () => {
      await upsert({
        maxPeriodsPerDay: 5,
        maxPeriodsPerWeek: 20,
        maxConsecutivePeriods: 3,
        availability: { '1': [1, 2, 3] },
      });

      expect(prisma.teacherConstraint.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantMembershipId: MEMBERSHIP_ID },
          update: expect.objectContaining({
            maxPeriodsPerDay: 5,
            availability: { '1': [1, 2, 3] },
            deletedAt: null,
            updatedBy: USER_ID,
          }),
          create: expect.objectContaining({
            tenantId: TENANT_ID,
            tenantMembershipId: MEMBERSHIP_ID,
            createdBy: USER_ID,
          }),
        }),
      );
    });

    it('maps a null availability to Prisma.DbNull', async () => {
      await upsert({ availability: null });

      const call = prisma.teacherConstraint.upsert.mock.calls[0][0];
      expect(call.update.availability).toBe(Prisma.DbNull);
    });
  });

  describe('remove', () => {
    it('404s when no constraint exists', async () => {
      prisma.teacherConstraint.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(TENANT_ID, MEMBERSHIP_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('soft deletes an existing constraint', async () => {
      prisma.teacherConstraint.findFirst.mockResolvedValue({ id: 'con-1' });

      await service.remove(TENANT_ID, MEMBERSHIP_ID, USER_ID);

      expect(prisma.teacherConstraint.update).toHaveBeenCalledWith({
        where: { id: 'con-1' },
        data: { deletedAt: expect.any(Date), updatedBy: USER_ID },
      });
    });
  });
});
