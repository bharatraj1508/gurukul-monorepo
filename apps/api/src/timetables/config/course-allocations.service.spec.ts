import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from 'nestjs-prisma';

import { CourseAllocationsService } from './course-allocations.service';

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';
const CLASS_ID = 'class-1';

const klass = { id: CLASS_ID, programId: 'prog-1', name: '10-A' };

describe('CourseAllocationsService', () => {
  let service: CourseAllocationsService;
  let prisma: {
    courseAllocation: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    class: { findFirst: jest.Mock };
    course: { findMany: jest.Mock };
    room: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      courseAllocation: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      class: { findFirst: jest.fn().mockResolvedValue(klass) },
      course: { findMany: jest.fn().mockResolvedValue([]) },
      room: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CourseAllocationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(CourseAllocationsService);
  });

  const replace = (allocations: any[]) =>
    service.replaceForClass(TENANT_ID, CLASS_ID, USER_ID, { allocations });

  describe('findAll', () => {
    it('scopes to tenant, optional class, and excludes soft-deleted', async () => {
      await service.findAll(TENANT_ID, CLASS_ID);

      expect(prisma.courseAllocation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID, deletedAt: null, classId: CLASS_ID },
        }),
      );
    });
  });

  describe('replaceForClass', () => {
    it('404s for an unknown class', async () => {
      prisma.class.findFirst.mockResolvedValue(null);

      await expect(replace([])).rejects.toThrow(NotFoundException);
    });

    it('rejects a course outside the class program', async () => {
      prisma.course.findMany.mockResolvedValue([
        { id: 'course-1', name: 'Physics', programId: 'other-prog' },
      ]);

      await expect(
        replace([{ courseId: 'course-1', periodsPerWeek: 4 }]),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a blockSize that does not divide periodsPerWeek', async () => {
      await expect(
        replace([
          {
            courseId: 'course-1',
            periodsPerWeek: 5,
            consecutiveBlockSize: 2,
          },
        ]),
      ).rejects.toThrow(/must divide/);
    });

    it('rejects providing both roomId and roomType', async () => {
      await expect(
        replace([
          {
            courseId: 'course-1',
            periodsPerWeek: 4,
            roomId: 'room-1',
            roomType: 'SCIENCE_LAB',
          },
        ]),
      ).rejects.toThrow(/either roomId or roomType/);
    });

    it('rejects duplicate courses in one payload', async () => {
      await expect(
        replace([
          { courseId: 'course-1', periodsPerWeek: 4 },
          { courseId: 'course-1', periodsPerWeek: 2 },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates new allocations and soft-deletes unlisted ones', async () => {
      prisma.course.findMany.mockResolvedValue([
        { id: 'course-1', name: 'Math', programId: 'prog-1' },
      ]);
      // First findMany: existing rows (for revive logic). Second: findAll return.
      prisma.courseAllocation.findMany
        .mockResolvedValueOnce([]) // existing
        .mockResolvedValueOnce([]); // findAll

      await replace([{ courseId: 'course-1', periodsPerWeek: 4 }]);

      expect(prisma.courseAllocation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            classId: CLASS_ID,
            deletedAt: null,
            courseId: { notIn: ['course-1'] },
          }),
        }),
      );
      expect(prisma.courseAllocation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            classId: CLASS_ID,
            courseId: 'course-1',
            periodsPerWeek: 4,
            consecutiveBlockSize: 1,
            createdBy: USER_ID,
          }),
        }),
      );
    });

    it('revives an existing (soft-deleted) allocation instead of creating', async () => {
      prisma.course.findMany.mockResolvedValue([
        { id: 'course-1', name: 'Math', programId: 'prog-1' },
      ]);
      prisma.courseAllocation.findMany
        .mockResolvedValueOnce([{ id: 'alloc-1', courseId: 'course-1' }]) // existing
        .mockResolvedValueOnce([]); // findAll

      await replace([{ courseId: 'course-1', periodsPerWeek: 6 }]);

      expect(prisma.courseAllocation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'alloc-1' },
          data: expect.objectContaining({
            deletedAt: null,
            periodsPerWeek: 6,
            updatedBy: USER_ID,
          }),
        }),
      );
      expect(prisma.courseAllocation.create).not.toHaveBeenCalled();
    });
  });
});
