/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PERMS } from '@repo/permissions';
import { PrismaService } from 'nestjs-prisma';

import { JwtPayload } from '../users/types';
import { DiaryService } from './diary.service';

describe('DiaryService', () => {
  let service: DiaryService;
  let prisma: any;

  const mockPrisma = {
    diary: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    academicTerm: { findFirst: jest.fn() },
    program: { findFirst: jest.fn() },
    class: { findFirst: jest.fn(), findMany: jest.fn() },
    course: { findFirst: jest.fn() },
    enrolment: { findMany: jest.fn() },
    classInstructor: { findMany: jest.fn(), findFirst: jest.fn() },
    studentProfile: { findFirst: jest.fn() },
    parentProfile: { findFirst: jest.fn() },
    studentParent: { findMany: jest.fn() },
    tenantMembership: { findFirst: jest.fn() },
  };

  const adminUser: JwtPayload = {
    sub: 'user-1',
    email: 'a@b.c',
    tenantId: 'tenant-1',
    membershipId: 'mem-1',
    scopes: [],
    isAdmin: true,
  };

  const facultyUser: JwtPayload = {
    sub: 'user-2',
    email: 't@b.c',
    tenantId: 'tenant-1',
    membershipId: 'mem-2',
    scopes: [PERMS.diary.viewOwn.id],
    isAdmin: false,
  };

  const noAccessUser: JwtPayload = {
    sub: 'user-3',
    email: 'x@b.c',
    tenantId: 'tenant-1',
    membershipId: 'mem-3',
    scopes: [],
    isAdmin: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiaryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DiaryService>(DiaryService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto = {
      termId: 'term-1',
      programId: 'program-1',
      classId: 'class-1',
      note: 'Bring your lab coat tomorrow.',
    };

    it('creates a note when term/program/class are valid and consistent', async () => {
      prisma.academicTerm.findFirst.mockResolvedValue({ id: 'term-1' });
      prisma.program.findFirst.mockResolvedValue({ id: 'program-1' });
      prisma.class.findFirst.mockResolvedValue({
        id: 'class-1',
        academicTermId: 'term-1',
        programId: 'program-1',
      });
      prisma.diary.create.mockResolvedValue({ id: 'diary-1' });

      await service.create('tenant-1', adminUser, dto);

      expect(prisma.diary.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          termId: 'term-1',
          programId: 'program-1',
          classId: 'class-1',
          courseId: null,
          note: dto.note,
          studentIds: [],
          createdBy: adminUser.sub,
          updatedBy: adminUser.sub,
        },
      });
    });

    it('rejects when the class does not belong to the program', async () => {
      prisma.academicTerm.findFirst.mockResolvedValue({ id: 'term-1' });
      prisma.program.findFirst.mockResolvedValue({ id: 'program-1' });
      prisma.class.findFirst.mockResolvedValue({
        id: 'class-1',
        academicTermId: 'term-1',
        programId: 'other-program',
      });

      await expect(
        service.create('tenant-1', adminUser, dto),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.diary.create).not.toHaveBeenCalled();
    });

    it('rejects when a target student is not enrolled in the class', async () => {
      prisma.academicTerm.findFirst.mockResolvedValue({ id: 'term-1' });
      prisma.program.findFirst.mockResolvedValue({ id: 'program-1' });
      prisma.class.findFirst.mockResolvedValue({
        id: 'class-1',
        academicTermId: 'term-1',
        programId: 'program-1',
      });
      prisma.enrolment.findMany.mockResolvedValue([
        { studentProfileId: 'stu-1' },
      ]); // only 1 of 2 enrolled

      await expect(
        service.create('tenant-1', adminUser, {
          ...dto,
          studentIds: ['stu-1', 'stu-2'],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.diary.create).not.toHaveBeenCalled();
    });

    it('rejects when the caller does not instruct the class', async () => {
      prisma.academicTerm.findFirst.mockResolvedValue({ id: 'term-1' });
      prisma.program.findFirst.mockResolvedValue({ id: 'program-1' });
      prisma.class.findFirst.mockResolvedValue({
        id: 'class-1',
        academicTermId: 'term-1',
        programId: 'program-1',
      });
      prisma.classInstructor.findFirst.mockResolvedValue(null);

      await expect(
        service.create('tenant-1', facultyUser, dto),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.diary.create).not.toHaveBeenCalled();
    });

    it('creates a note when the caller instructs the class', async () => {
      prisma.academicTerm.findFirst.mockResolvedValue({ id: 'term-1' });
      prisma.program.findFirst.mockResolvedValue({ id: 'program-1' });
      prisma.class.findFirst.mockResolvedValue({
        id: 'class-1',
        academicTermId: 'term-1',
        programId: 'program-1',
      });
      prisma.classInstructor.findFirst.mockResolvedValue({ id: 'ci-1' });
      prisma.diary.create.mockResolvedValue({ id: 'diary-1' });

      await service.create('tenant-1', facultyUser, dto);

      expect(prisma.diary.create).toHaveBeenCalled();
    });

    it('bypasses the instructor check for admins', async () => {
      prisma.academicTerm.findFirst.mockResolvedValue({ id: 'term-1' });
      prisma.program.findFirst.mockResolvedValue({ id: 'program-1' });
      prisma.class.findFirst.mockResolvedValue({
        id: 'class-1',
        academicTermId: 'term-1',
        programId: 'program-1',
      });
      prisma.diary.create.mockResolvedValue({ id: 'diary-1' });

      await service.create('tenant-1', adminUser, dto);

      expect(prisma.classInstructor.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates a note when the caller instructs the class', async () => {
      prisma.diary.findFirst.mockResolvedValue({
        id: 'diary-1',
        classId: 'class-1',
        programId: 'program-1',
      });
      prisma.diary.update.mockResolvedValue({ id: 'diary-1' });

      await service.update('tenant-1', adminUser, 'diary-1', {
        note: 'Updated note.',
      });

      expect(prisma.diary.update).toHaveBeenCalledWith({
        where: { id: 'diary-1' },
        data: {
          note: 'Updated note.',
          courseId: undefined,
          studentIds: undefined,
          updatedBy: adminUser.sub,
        },
      });
    });

    it('throws when the note does not exist', async () => {
      prisma.diary.findFirst.mockResolvedValue(null);

      await expect(
        service.update('tenant-1', adminUser, 'missing', { note: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the caller does not instruct the note\'s class', async () => {
      prisma.diary.findFirst.mockResolvedValue({
        id: 'diary-1',
        classId: 'class-1',
        programId: 'program-1',
      });
      prisma.classInstructor.findFirst.mockResolvedValue(null);

      await expect(
        service.update('tenant-1', facultyUser, 'diary-1', { note: 'x' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.diary.update).not.toHaveBeenCalled();
    });

    it('validates the course belongs to the note\'s program for an instructor', async () => {
      prisma.diary.findFirst.mockResolvedValue({
        id: 'diary-1',
        classId: 'class-1',
        programId: 'program-1',
      });
      prisma.classInstructor.findFirst.mockResolvedValue({ id: 'ci-1' });
      prisma.course.findFirst.mockResolvedValue(null);

      await expect(
        service.update('tenant-1', facultyUser, 'diary-1', {
          courseId: 'course-x',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.diary.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft-deletes an existing note', async () => {
      prisma.diary.findFirst.mockResolvedValue({
        id: 'diary-1',
        classId: 'class-1',
      });
      prisma.diary.update.mockResolvedValue({ id: 'diary-1' });

      await service.remove('tenant-1', adminUser, 'diary-1');

      expect(prisma.diary.update).toHaveBeenCalledWith({
        where: { id: 'diary-1' },
        data: { deletedAt: expect.any(Date), updatedBy: adminUser.sub },
      });
    });

    it('throws when the note does not exist', async () => {
      prisma.diary.findFirst.mockResolvedValue(null);
      await expect(
        service.remove('tenant-1', adminUser, 'missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the caller does not instruct the note\'s class', async () => {
      prisma.diary.findFirst.mockResolvedValue({
        id: 'diary-1',
        classId: 'class-1',
      });
      prisma.classInstructor.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('tenant-1', facultyUser, 'diary-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.diary.update).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns all tenant notes for an admin (scope=all)', async () => {
      prisma.diary.findMany.mockResolvedValue([]);

      await service.findAll('tenant-1', adminUser, {});

      expect(prisma.diary.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', deletedAt: null },
        }),
      );
    });

    it('scopes a faculty caller (scope=own) to their instructed classes', async () => {
      prisma.classInstructor.findMany.mockResolvedValue([
        { classId: 'class-1' },
        { classId: 'class-2' },
      ]);
      prisma.studentProfile.findFirst.mockResolvedValue(null);
      prisma.parentProfile.findFirst.mockResolvedValue(null);
      prisma.diary.findMany.mockResolvedValue([]);

      await service.findAll('tenant-1', facultyUser, {});

      expect(prisma.diary.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            deletedAt: null,
            OR: [{ classId: { in: ['class-1', 'class-2'] } }],
          },
        }),
      );
    });

    it('returns [] for an own caller who owns nothing', async () => {
      prisma.classInstructor.findMany.mockResolvedValue([]);
      prisma.studentProfile.findFirst.mockResolvedValue(null);
      prisma.parentProfile.findFirst.mockResolvedValue(null);

      const result = await service.findAll('tenant-1', facultyUser, {});

      expect(result).toEqual([]);
      expect(prisma.diary.findMany).not.toHaveBeenCalled();
    });

    it('throws when the caller has no diary access (scope=none)', async () => {
      await expect(
        service.findAll('tenant-1', noAccessUser, {}),
      ).rejects.toThrow('access');
    });
  });

  describe('findOne', () => {
    it('lets an admin (scope=all) see any note', async () => {
      prisma.diary.findFirst.mockResolvedValue({ id: 'diary-1' });

      const result = await service.findOne('tenant-1', adminUser, 'diary-1');

      expect(result).toEqual({ id: 'diary-1' });
      expect(prisma.diary.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'diary-1', tenantId: 'tenant-1', deletedAt: null },
        }),
      );
    });

    it('lets an own-scope caller see a note in their scope', async () => {
      prisma.classInstructor.findMany.mockResolvedValue([
        { classId: 'class-1' },
      ]);
      prisma.studentProfile.findFirst.mockResolvedValue(null);
      prisma.parentProfile.findFirst.mockResolvedValue(null);
      prisma.diary.findFirst.mockResolvedValue({ id: 'diary-1' });

      const result = await service.findOne(
        'tenant-1',
        facultyUser,
        'diary-1',
      );

      expect(result).toEqual({ id: 'diary-1' });
      expect(prisma.diary.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ classId: { in: ['class-1'] } }],
          }),
        }),
      );
    });

    it('throws 404 for a note outside the caller\'s scope', async () => {
      prisma.classInstructor.findMany.mockResolvedValue([
        { classId: 'class-1' },
      ]);
      prisma.studentProfile.findFirst.mockResolvedValue(null);
      prisma.parentProfile.findFirst.mockResolvedValue(null);
      prisma.diary.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('tenant-1', facultyUser, 'diary-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when the caller has no diary access (scope=none)', async () => {
      await expect(
        service.findOne('tenant-1', noAccessUser, 'diary-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getOptions', () => {
    const classRow = {
      id: 'class-1',
      name: 'Class 1',
      program: {
        id: 'program-1',
        name: 'Program 1',
        code: 'P1',
        courses: [{ id: 'course-1', name: 'Course 1', code: 'C1' }],
      },
      academicTerm: { id: 'term-1', name: 'Term 1' },
      enrolments: [],
    };

    it('returns all tenant classes for an admin', async () => {
      prisma.class.findMany.mockResolvedValue([classRow]);

      const result = await service.getOptions('tenant-1', adminUser);

      expect(prisma.class.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', deletedAt: null },
        }),
      );
      expect(result).toEqual([
        {
          id: 'class-1',
          name: 'Class 1',
          program: { id: 'program-1', name: 'Program 1', code: 'P1' },
          term: { id: 'term-1', name: 'Term 1' },
          courses: [{ id: 'course-1', name: 'Course 1', code: 'C1' }],
          students: [],
        },
      ]);
    });

    it('limits a faculty caller to their instructed classes', async () => {
      prisma.classInstructor.findMany.mockResolvedValue([
        { classId: 'class-1' },
      ]);
      prisma.class.findMany.mockResolvedValue([classRow]);

      await service.getOptions('tenant-1', facultyUser);

      expect(prisma.class.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            deletedAt: null,
            id: { in: ['class-1'] },
          },
        }),
      );
    });

    it('returns [] for a faculty caller with no instructed classes', async () => {
      prisma.classInstructor.findMany.mockResolvedValue([]);

      const result = await service.getOptions('tenant-1', facultyUser);

      expect(result).toEqual([]);
      expect(prisma.class.findMany).not.toHaveBeenCalled();
    });
  });
});
