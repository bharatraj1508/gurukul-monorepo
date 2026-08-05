import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from 'nestjs-prisma';

import { TimetableSnapshotService } from './timetable-snapshot.service';

const TENANT_ID = 'tenant-1';

const dto = { academicTermId: 'term-1', periodTemplateId: 'tpl-1' } as any;

const template = {
  id: 'tpl-1',
  workingDays: [1, 2, 3, 4, 5],
  slots: [
    { kind: 'PERIOD', periodNumber: 1, sortOrder: 0 },
    { kind: 'PERIOD', periodNumber: 2, sortOrder: 1 },
    { kind: 'BREAK', periodNumber: null, sortOrder: 2 },
  ],
};

const klass = {
  id: 'class-1',
  name: '10-A',
  _count: { enrolments: 20 },
};

const allocation = {
  id: 'alloc-1',
  classId: 'class-1',
  courseId: 'course-1',
  course: { id: 'course-1', name: 'Math' },
  periodsPerWeek: 4,
  consecutiveBlockSize: 1,
  roomId: null,
  roomType: null,
};

/** A ClassInstructorCourse row for the (class-1, course-1) pairing. */
const cic = (overrides: {
  id: string;
  isPrimary: boolean;
  membershipId: string;
  createdAt: Date;
}) => ({
  id: overrides.id,
  courseId: 'course-1',
  createdAt: overrides.createdAt,
  classInstructor: {
    classId: 'class-1',
    isPrimary: overrides.isPrimary,
    tenantMembershipId: overrides.membershipId,
    createdAt: overrides.createdAt,
  },
});

describe('TimetableSnapshotService', () => {
  let service: TimetableSnapshotService;
  let prisma: {
    academicTerm: { findFirst: jest.Mock };
    periodTemplate: { findFirst: jest.Mock };
    class: { findMany: jest.Mock };
    courseAllocation: { findMany: jest.Mock };
    classInstructorCourse: { findMany: jest.Mock };
    tenantMembership: { findMany: jest.Mock };
    teacherConstraint: { findMany: jest.Mock };
    room: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      academicTerm: {
        findFirst: jest.fn().mockResolvedValue({ id: 'term-1', name: 'T1' }),
      },
      periodTemplate: { findFirst: jest.fn().mockResolvedValue(template) },
      class: { findMany: jest.fn().mockResolvedValue([klass]) },
      courseAllocation: { findMany: jest.fn().mockResolvedValue([allocation]) },
      classInstructorCourse: { findMany: jest.fn().mockResolvedValue([]) },
      tenantMembership: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'mem-1', user: { firstName: 'Ada', lastName: 'L' } },
          { id: 'mem-2', user: { firstName: 'Bob', lastName: 'M' } },
        ]),
      },
      teacherConstraint: { findMany: jest.fn().mockResolvedValue([]) },
      room: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableSnapshotService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(TimetableSnapshotService);
  });

  it('404s for an unknown academic term', async () => {
    prisma.academicTerm.findFirst.mockResolvedValue(null);

    await expect(service.build(TENANT_ID, dto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('404s for an unknown period template', async () => {
    prisma.periodTemplate.findFirst.mockResolvedValue(null);

    await expect(service.build(TENANT_ID, dto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('flags MISSING_INSTRUCTOR when no CIC covers the allocation', async () => {
    prisma.classInstructorCourse.findMany.mockResolvedValue([]);

    const { issues, payload } = await service.build(TENANT_ID, dto);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_INSTRUCTOR',
          severity: 'ERROR',
        }),
      ]),
    );
    expect(payload.lessons).toHaveLength(0);
  });

  it('resolves the primary instructor over an older non-primary one', async () => {
    prisma.classInstructorCourse.findMany.mockResolvedValue([
      cic({
        id: 'cic-old',
        isPrimary: false,
        membershipId: 'mem-2',
        createdAt: new Date('2020-01-01'),
      }),
      cic({
        id: 'cic-primary',
        isPrimary: true,
        membershipId: 'mem-1',
        createdAt: new Date('2024-01-01'),
      }),
    ]);

    const { payload, issues } = await service.build(TENANT_ID, dto);

    expect(payload.lessons[0].teacherId).toBe('mem-1');
    // Two candidates -> ambiguity warning.
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'AMBIGUOUS_INSTRUCTOR',
          severity: 'WARNING',
        }),
      ]),
    );
  });

  it('picks the oldest instructor when none is primary', async () => {
    prisma.classInstructorCourse.findMany.mockResolvedValue([
      cic({
        id: 'cic-new',
        isPrimary: false,
        membershipId: 'mem-2',
        createdAt: new Date('2024-06-01'),
      }),
      cic({
        id: 'cic-old',
        isPrimary: false,
        membershipId: 'mem-1',
        createdAt: new Date('2020-01-01'),
      }),
    ]);

    const { payload } = await service.build(TENANT_ID, dto);

    expect(payload.lessons[0].teacherId).toBe('mem-1');
  });

  it('defaults teacher availability/caps to null when no constraint exists', async () => {
    prisma.classInstructorCourse.findMany.mockResolvedValue([
      cic({
        id: 'cic-1',
        isPrimary: true,
        membershipId: 'mem-1',
        createdAt: new Date('2024-01-01'),
      }),
    ]);
    prisma.teacherConstraint.findMany.mockResolvedValue([]);

    const { payload } = await service.build(TENANT_ID, dto);

    const teacher = payload.teachers.find((t) => t.id === 'mem-1');
    expect(teacher).toMatchObject({
      maxPeriodsPerDay: null,
      maxPeriodsPerWeek: null,
      maxConsecutivePeriods: null,
      availability: null,
    });
  });

  it('applies a soft-constraint (non-deleted) availability to the teacher', async () => {
    prisma.classInstructorCourse.findMany.mockResolvedValue([
      cic({
        id: 'cic-1',
        isPrimary: true,
        membershipId: 'mem-1',
        createdAt: new Date('2024-01-01'),
      }),
    ]);
    prisma.teacherConstraint.findMany.mockResolvedValue([
      {
        tenantMembershipId: 'mem-1',
        maxPeriodsPerDay: 5,
        maxPeriodsPerWeek: 20,
        maxConsecutivePeriods: 3,
        availability: { '1': [1, 2] },
      },
    ]);

    const { payload } = await service.build(TENANT_ID, dto);

    // The constraint query is scoped to deletedAt: null (soft-deleted excluded).
    expect(prisma.teacherConstraint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
    const teacher = payload.teachers.find((t) => t.id === 'mem-1');
    expect(teacher?.availability).toEqual({ '1': [1, 2] });
    expect(teacher?.maxPeriodsPerDay).toBe(5);
  });

  it('excludes soft-deleted CIC rows via the query filter', async () => {
    prisma.classInstructorCourse.findMany.mockResolvedValue([
      cic({
        id: 'cic-1',
        isPrimary: true,
        membershipId: 'mem-1',
        createdAt: new Date('2024-01-01'),
      }),
    ]);

    await service.build(TENANT_ID, dto);

    expect(prisma.classInstructorCourse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });
});
