/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from 'nestjs-prisma';

import { CoursesService } from './courses.service';

describe('CoursesService', () => {
  let service: CoursesService;
  let prisma: any;

  const mockPrisma = {
    program: {
      findFirst: jest.fn(),
    },
    course: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    class: {
      count: jest.fn(),
    },
    classInstructorCourse: {
      findMany: jest.fn(),
    },
    studentProfile: {
      findFirst: jest.fn(),
    },
    enrolment: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a course successfully', async () => {
      prisma.program.findFirst.mockResolvedValue({ id: 'program-1' });
      prisma.course.findFirst.mockResolvedValue(null);
      prisma.course.create.mockResolvedValue({
        id: 'course-1',
        name: 'Mathematics',
        code: 'MATH101',
      });

      const result = await service.create('tenant-1', 'user-1', {
        programId: 'program-1',
        name: 'Mathematics',
        code: 'MATH101',
        description: 'Math Intro',
        credits: 4,
      });

      expect(prisma.program.findFirst).toHaveBeenCalled();
      expect(prisma.course.findFirst).toHaveBeenCalled();
      expect(prisma.course.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          programId: 'program-1',
          name: 'Mathematics',
          code: 'MATH101',
          description: 'Math Intro',
          credits: 4,
          createdBy: 'user-1',
          updatedBy: 'user-1',
        },
      });
      expect(result.id).toBe('course-1');
    });

    it('should throw BadRequestException if program is not found', async () => {
      prisma.program.findFirst.mockResolvedValue(null);

      await expect(
        service.create('tenant-1', 'user-1', {
          programId: 'program-invalid',
          name: 'Mathematics',
          code: 'MATH101',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if course code duplicate exists', async () => {
      prisma.program.findFirst.mockResolvedValue({ id: 'program-1' });
      prisma.course.findFirst.mockResolvedValue({
        id: 'course-exist',
        code: 'MATH101',
      });

      await expect(
        service.create('tenant-1', 'user-1', {
          programId: 'program-1',
          name: 'Mathematics',
          code: 'MATH101',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update course details successfully', async () => {
      const existing = { id: 'course-1', code: 'MATH101', name: 'Math' };
      prisma.course.findFirst.mockResolvedValue(existing);
      prisma.course.update.mockResolvedValue({ ...existing, name: 'Math Rev' });

      const result = await service.update('tenant-1', 'user-1', 'course-1', {
        name: 'Math Rev',
      });

      expect(prisma.course.update).toHaveBeenCalled();
      expect(result.name).toBe('Math Rev');
    });

    it('should block duplicate course codes on update', async () => {
      const existing = { id: 'course-1', code: 'MATH101' };
      prisma.course.findFirst
        .mockResolvedValueOnce(existing) // for existing check
        .mockResolvedValueOnce({ id: 'course-other', code: 'MATH102' }); // for duplicate check

      await expect(
        service.update('tenant-1', 'user-1', 'course-1', {
          code: 'MATH102',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('returns the unfiltered list when scope is "all"', async () => {
      prisma.course.findMany.mockResolvedValue([{ id: 'course-1' }]);

      const result = await service.findAll('tenant-1', {}, { scope: 'all' });

      expect(prisma.studentProfile.findFirst).not.toHaveBeenCalled();
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', deletedAt: null },
        }),
      );
      expect(result).toEqual([{ id: 'course-1' }]);
    });

    it('scopes to the student’s enrolled program(s) when scope is "own"', async () => {
      prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-1' });
      prisma.enrolment.findMany.mockResolvedValue([
        { class: { programId: 'program-1' } },
      ]);
      prisma.course.findMany.mockResolvedValue([
        { id: 'course-1', programId: 'program-1' },
      ]);

      const result = await service.findAll(
        'tenant-1',
        {},
        { scope: 'own', membershipId: 'membership-1' },
      );

      expect(prisma.studentProfile.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          tenantMembershipId: 'membership-1',
          deletedAt: null,
        },
        select: { id: true },
      });
      expect(prisma.enrolment.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          studentProfileId: 'student-1',
          status: 'ACTIVE',
          deletedAt: null,
          class: { deletedAt: null },
        },
        select: { class: { select: { programId: true } } },
      });
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            deletedAt: null,
            AND: [{ programId: { in: ['program-1'] } }],
          }),
        }),
      );
      expect(result).toEqual([{ id: 'course-1', programId: 'program-1' }]);
    });

    it('unions program ids across multiple active enrolments', async () => {
      prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-1' });
      prisma.enrolment.findMany.mockResolvedValue([
        { class: { programId: 'program-1' } },
        { class: { programId: 'program-2' } },
      ]);
      prisma.course.findMany.mockResolvedValue([]);

      await service.findAll(
        'tenant-1',
        {},
        { scope: 'own', membershipId: 'membership-1' },
      );

      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [{ programId: { in: ['program-1', 'program-2'] } }],
          }),
        }),
      );
    });

    it('returns an empty list without querying courses when the student has no active enrolments', async () => {
      prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-1' });
      prisma.enrolment.findMany.mockResolvedValue([]);

      const result = await service.findAll(
        'tenant-1',
        {},
        { scope: 'own', membershipId: 'membership-1' },
      );

      expect(result).toEqual([]);
      expect(prisma.course.findMany).not.toHaveBeenCalled();
    });

    it('returns an empty list when no student profile is linked to the membership', async () => {
      prisma.studentProfile.findFirst.mockResolvedValue(null);

      const result = await service.findAll(
        'tenant-1',
        {},
        { scope: 'own', membershipId: 'membership-1' },
      );

      expect(result).toEqual([]);
      expect(prisma.enrolment.findMany).not.toHaveBeenCalled();
      expect(prisma.course.findMany).not.toHaveBeenCalled();
    });

    it('combines the "own" scope filter with an explicit search filter', async () => {
      prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-1' });
      prisma.enrolment.findMany.mockResolvedValue([
        { class: { programId: 'program-1' } },
      ]);
      prisma.course.findMany.mockResolvedValue([]);

      await service.findAll(
        'tenant-1',
        { search: 'math' },
        { scope: 'own', membershipId: 'membership-1' },
      );

      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [
              { programId: { in: ['program-1'] } },
              {
                OR: [
                  { name: { contains: 'math', mode: 'insensitive' } },
                  { code: { contains: 'math', mode: 'insensitive' } },
                ],
              },
            ],
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('attaches teachers scoped by class-course assignments', async () => {
      prisma.course.findFirst.mockResolvedValue({
        id: 'course-1',
        name: 'Mathematics',
        program: { id: 'program-1', name: 'Science', code: 'SCI', classes: [] },
      });
      prisma.classInstructorCourse.findMany.mockResolvedValue([
        {
          classInstructor: {
            class: { id: 'class-1', name: 'Class A' },
            membership: {
              id: 'membership-1',
              user: {
                id: 'user-1',
                firstName: 'Jane',
                lastName: 'Doe',
                email: 'jane@example.com',
              },
            },
          },
        },
      ]);

      const result = await service.findOne('tenant-1', 'course-1');

      expect(prisma.classInstructorCourse.findMany).toHaveBeenCalledWith({
        where: {
          courseId: 'course-1',
          tenantId: 'tenant-1',
          deletedAt: null,
          classInstructor: {
            deletedAt: null,
            class: { deletedAt: null },
          },
        },
        include: expect.any(Object),
      });
      expect(result.teachers).toEqual([
        {
          membershipId: 'membership-1',
          userId: 'user-1',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          classId: 'class-1',
          className: 'Class A',
        },
      ]);
    });

    it('throws NotFoundException for a missing course regardless of scope', async () => {
      prisma.course.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('tenant-1', 'course-missing', {
          scope: 'own',
          membershipId: 'membership-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns the course when scope is "own" and it is in the student’s program', async () => {
      prisma.course.findFirst.mockResolvedValue({
        id: 'course-1',
        programId: 'program-1',
        program: { id: 'program-1', name: 'Science', code: 'SCI', classes: [] },
      });
      prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-1' });
      prisma.enrolment.findMany.mockResolvedValue([
        { class: { programId: 'program-1' } },
      ]);
      prisma.classInstructorCourse.findMany.mockResolvedValue([]);

      const result = await service.findOne('tenant-1', 'course-1', {
        scope: 'own',
        membershipId: 'membership-1',
      });

      expect(result.id).toBe('course-1');
    });

    it('throws ForbiddenException when scope is "own" and the course is outside the student’s program(s)', async () => {
      prisma.course.findFirst.mockResolvedValue({
        id: 'course-1',
        programId: 'program-other',
        program: {
          id: 'program-other',
          name: 'Arts',
          code: 'ART',
          classes: [],
        },
      });
      prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-1' });
      prisma.enrolment.findMany.mockResolvedValue([
        { class: { programId: 'program-1' } },
      ]);

      await expect(
        service.findOne('tenant-1', 'course-1', {
          scope: 'own',
          membershipId: 'membership-1',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.classInstructorCourse.findMany).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete successfully if no classes are scheduled for the program', async () => {
      prisma.course.findFirst.mockResolvedValue({
        id: 'course-1',
        programId: 'program-1',
      });
      prisma.class.count.mockResolvedValue(0);
      prisma.course.update.mockResolvedValue({
        id: 'course-1',
        deletedAt: new Date(),
      });

      await service.remove('tenant-1', 'user-1', 'course-1');

      expect(prisma.course.update).toHaveBeenCalledWith({
        where: { id: 'course-1' },
        data: {
          deletedAt: expect.any(Date),
          updatedBy: 'user-1',
        },
      });
    });

    it('should block soft delete if classes are scheduled for the course program', async () => {
      prisma.course.findFirst.mockResolvedValue({
        id: 'course-1',
        programId: 'program-1',
      });
      prisma.class.count.mockResolvedValue(2); // 2 active sections exist

      await expect(
        service.remove('tenant-1', 'user-1', 'course-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
