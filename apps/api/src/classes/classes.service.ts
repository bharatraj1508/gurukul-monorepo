import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';
import { PrismaService } from 'nestjs-prisma';

import { AttendanceStatus } from '../attendance/dto/attendance-entry.dto';
import { CreateClassDto, UpdateClassDto } from './dto';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    filters: {
      term?: string;
      program?: string;
      course?: string;
      instructor?: string;
      section?: string;
    },
  ) {
    const classes = await this.prisma.class.findMany({
      where: {
        id: filters.section
          ? filters.section.includes(',')
            ? { in: filters.section.split(',') }
            : filters.section
          : undefined,
        tenantId,
        deletedAt: null,
        academicTermId: filters.term
          ? filters.term.includes(',')
            ? { in: filters.term.split(',') }
            : filters.term
          : undefined,
        programId: filters.program
          ? filters.program.includes(',')
            ? { in: filters.program.split(',') }
            : filters.program
          : undefined,
        program: filters.course
          ? {
              courses: {
                some: filters.course.includes(',')
                  ? { id: { in: filters.course.split(',') }, deletedAt: null }
                  : { id: filters.course, deletedAt: null },
              },
              deletedAt: null,
            }
          : {
              deletedAt: null,
            },
        instructors: filters.instructor
          ? {
              some: {
                tenantMembershipId: filters.instructor.includes(',')
                  ? { in: filters.instructor.split(',') }
                  : filters.instructor,
                deletedAt: null,
              },
            }
          : undefined,
      },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        academicTerm: {
          select: {
            id: true,
            name: true,
          },
        },
        instructors: {
          where: {
            deletedAt: null,
          },
          include: {
            membership: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        enrolments: {
          where: {
            status: 'ACTIVE',
            deletedAt: null,
          },
          select: {
            id: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        updater: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return classes.map((cls) => {
      const primaryInst = cls.instructors.find((i) => i.isPrimary);
      const primaryInstructor = primaryInst
        ? {
            membershipId: primaryInst.membership.id,
            userId: primaryInst.membership.user.id,
            firstName: primaryInst.membership.user.firstName,
            lastName: primaryInst.membership.user.lastName,
            email: primaryInst.membership.user.email,
          }
        : null;

      return {
        id: cls.id,
        name: cls.name,
        maxCapacity: cls.maxCapacity,
        status: cls.status,
        enrolledCount: cls.enrolments.length,
        createdAt: cls.createdAt,
        updatedAt: cls.updatedAt,
        program: cls.program,
        academicTerm: cls.academicTerm,
        primaryInstructor,
        creator: cls.creator,
        updater: cls.updater,
      };
    });
  }

  async findOne(tenantId: string, id: string) {
    const cls = await this.prisma.class.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        program: {
          include: {
            courses: {
              where: { deletedAt: null },
              select: {
                id: true,
                name: true,
                code: true,
                credits: true,
              },
            },
          },
        },
        academicTerm: true,
        instructors: {
          where: { deletedAt: null },
          include: {
            assignedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            membership: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },

            courseAssignments: {
              where: { deletedAt: null },
              include: {
                course: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
        enrolments: {
          where: { deletedAt: null },
          include: {
            student: {
              include: {
                membership: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        updater: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!cls) {
      throw new NotFoundException('Class/Section not found');
    }

    const enrolledStudents = cls.enrolments.map((e) => ({
      enrolmentId: e.id,
      studentProfileId: e.student.id,
      rollNumber: e.student.rollNumber,
      firstName: e.student.membership?.user?.firstName || 'Unknown',
      lastName: e.student.membership?.user?.lastName || '',
      email: e.student.membership?.user?.email || 'N/A',
      status: e.status, // ACTIVE, WITHDRAWN, COMPLETED
      enrolledAt: e.enrolledAt,
    }));

    const activeEnrolledCount = cls.enrolments.filter(
      (e) => e.status === 'ACTIVE',
    ).length;

    const instructorsList = cls.instructors.map((i) => ({
      id: i.id,
      membershipId: i.membership.id,
      userId: i.membership.user.id,
      firstName: i.membership.user.firstName,
      lastName: i.membership.user.lastName,
      email: i.membership.user.email,
      isPrimary: i.isPrimary,
      assignedAt: i.createdAt,
      assignedBy: i.assignedBy
        ? {
            id: i.assignedBy.id,
            firstName: i.assignedBy.firstName,
            lastName: i.assignedBy.lastName,
          }
        : null,
      courses: i.courseAssignments.map((ca) => ca.course),
    }));

    const now = new Date();
    const todayDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    const [todayAttendanceGroups, allAttendanceGroups] = await Promise.all([
      this.prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: {
          tenantId,
          enrolment: { classId: id },
          date: todayDate,
          deletedAt: null,
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: {
          tenantId,
          enrolment: { classId: id },
          date: { gte: cls.academicTerm.startDate, lte: todayDate },
          deletedAt: null,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const toAttendanceMap = (
      groups: typeof todayAttendanceGroups,
    ) =>
      groups.reduce(
        (acc, g) => {
          if (g.status && g._count) {
            acc[g.status] = g._count._all;
          }
          return acc;
        },
        {} as Record<string, number>,
      );

    const todayMap = toAttendanceMap(todayAttendanceGroups);
    const termMap = toAttendanceMap(allAttendanceGroups);

    const todayPresent = todayMap[AttendanceStatus.PRESENT] || 0;
    const todayAbsent = todayMap[AttendanceStatus.ABSENT] || 0;
    const todayLeave = todayMap[AttendanceStatus.LEAVE] || 0;

    const totalPresent = termMap[AttendanceStatus.PRESENT] || 0;
    const totalAbsent = termMap[AttendanceStatus.ABSENT] || 0;
    const totalLeave = termMap[AttendanceStatus.LEAVE] || 0;
    const totalRecords = totalPresent + totalAbsent + totalLeave;

    const averageAttendance =
      totalRecords > 0
        ? Math.round((totalPresent / totalRecords) * 100)
        : null;

    const attendanceOverview = {
      present: todayPresent,
      absent: todayAbsent,
      leave: todayLeave,
      totalStudents: activeEnrolledCount,
    };

    return {
      id: cls.id,
      name: cls.name,
      maxCapacity: cls.maxCapacity,
      status: cls.status,
      enrolledCount: activeEnrolledCount,
      program: {
        id: cls.program.id,
        name: cls.program.name,
        code: cls.program.code,
        courses: cls.program.courses,
      },
      academicTerm: {
        id: cls.academicTerm.id,
        name: cls.academicTerm.name,
        startDate: cls.academicTerm.startDate,
        endDate: cls.academicTerm.endDate,
        isActive: cls.academicTerm.isActive,
      },
      instructors: instructorsList,
      enrolledStudents,
      attendanceOverview,
      averageAttendance,
      createdAt: cls.createdAt,
      updatedAt: cls.updatedAt,
      creator: cls.creator,
      updater: cls.updater,
    };
  }

  async create(tenantId: string, userId: string, dto: CreateClassDto) {
    // 1. Verify term is non-archived (not soft-deleted)
    const term = await this.prisma.academicTerm.findFirst({
      where: {
        id: dto.academicTermId,
        tenantId,
        deletedAt: null,
      },
    });

    if (!term) {
      throw new BadRequestException(
        'Cannot schedule a class in an archived or non-existent academic term.',
      );
    }

    // 2. Verify program exists
    const program = await this.prisma.program.findFirst({
      where: {
        id: dto.programId,
        tenantId,
        deletedAt: null,
      },
    });

    if (!program) {
      throw new BadRequestException('Program not found.');
    }

    // 3. Name: use manual input or generate implicit name
    let className = dto.name?.trim();
    if (!className) {
      const classCount = await this.prisma.class.count({
        where: {
          tenantId,
          programId: dto.programId,
          academicTermId: dto.academicTermId,
          deletedAt: null,
        },
      });
      className = `Class #${classCount + 1}`;
    }

    // 4. Create class and instructors in transaction
    return this.prisma.class.create({
      data: {
        tenantId,
        academicTermId: dto.academicTermId,
        programId: dto.programId,
        name: className,
        maxCapacity: dto.maxCapacity,
        status: 'ACTIVE',
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateClassDto,
  ) {
    const existing = await this.prisma.class.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        enrolments: {
          where: { status: 'ACTIVE', deletedAt: null },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Class not found');
    }

    const activeCount = existing.enrolments.length;

    // Capacity block check
    if (dto.maxCapacity !== undefined && dto.maxCapacity < activeCount) {
      throw new BadRequestException(
        `Capacity cannot be reduced below the current number of active enrollments (${activeCount}).`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.class.update({
        where: { id },
        data: {
          name: dto.name,
          maxCapacity: dto.maxCapacity,
          status: dto.status,
          updatedBy: userId,
        },
      });

      if (
        dto.instructorIds !== undefined ||
        dto.primaryInstructorId !== undefined
      ) {
        // Delete existing class instructors
        await tx.classInstructor.deleteMany({
          where: { classId: id },
        });

        let newInstructors = dto.instructorIds || [];
        if (
          dto.primaryInstructorId &&
          !newInstructors.includes(dto.primaryInstructorId)
        ) {
          newInstructors = [...newInstructors, dto.primaryInstructorId];
        }

        if (newInstructors.length > 0) {
          await tx.classInstructor.createMany({
            data: newInstructors.map((instId) => ({
              tenantId,
              classId: id,
              tenantMembershipId: instId,
              isPrimary: instId === dto.primaryInstructorId,
              assignedById: userId,
            })),
          });
        }
      }

      return updated;
    });
  }

  async archive(tenantId: string, userId: string, id: string) {
    const existing = await this.prisma.class.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Class not found');
    }

    return this.prisma.class.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        updatedBy: userId,
      },
    });
  }

  async remove(tenantId: string, userId: string, id: string) {
    const existing = await this.prisma.class.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { enrolments: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Class not found');
    }

    if (existing._count.enrolments > 0) {
      throw new BadRequestException(
        'Cannot hard-delete a class with historical enrollments. Use Archive instead.',
      );
    }

    return this.prisma.class.delete({
      where: { id },
    });
  }

  async getOptions(
    tenantId: string,
    page: number,
    limit: number,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.ClassWhereInput = {
      tenantId,
      deletedAt: null,
    };
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }
    const [items, total] = await Promise.all([
      this.prisma.class.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
        },
      }),
      this.prisma.class.count({ where }),
    ]);
    return {
      items: items.map((c) => ({ value: c.id, label: c.name })),
      hasMore: skip + items.length < total,
      total,
    };
  }
}
