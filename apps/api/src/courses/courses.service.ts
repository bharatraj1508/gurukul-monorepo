import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';
import { PrismaService } from 'nestjs-prisma';

import { CreateCourseDto, UpdateCourseDto } from './dto';

type ScopeContext = { scope: 'all' | 'own'; membershipId?: string };

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getStudentProgramIds(
    tenantId: string,
    membershipId?: string,
  ): Promise<string[]> {
    if (!membershipId) return [];

    const studentProfile = await this.prisma.studentProfile.findFirst({
      where: { tenantId, tenantMembershipId: membershipId, deletedAt: null },
      select: { id: true },
    });
    if (!studentProfile) return [];

    const enrolments = await this.prisma.enrolment.findMany({
      where: {
        tenantId,
        studentProfileId: studentProfile.id,
        status: 'ACTIVE',
        deletedAt: null,
        class: { deletedAt: null },
      },
      select: { class: { select: { programId: true } } },
    });

    return [...new Set(enrolments.map((e) => e.class.programId))];
  }

  async create(tenantId: string, userId: string, dto: CreateCourseDto) {
    // 1. Verify program exists and is not deleted
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

    // 2. Validate course code is unique (database level @@unique([tenantId, code]))
    const existing = await this.prisma.course.findFirst({
      where: {
        tenantId,
        code: dto.code.trim(),
      },
    });

    if (existing) {
      if (existing.deletedAt) {
        throw new BadRequestException(
          'A deleted course with this code already exists. Please choose a different code.',
        );
      }
      throw new BadRequestException('A course with this code already exists.');
    }

    return this.prisma.course.create({
      data: {
        tenantId,
        programId: dto.programId,
        name: dto.name.trim(),
        code: dto.code.trim(),
        description: dto.description?.trim() || null,
        credits: dto.credits || null,
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  async findAll(
    tenantId: string,
    filters?: { programId?: string; search?: string },
    scopeCtx?: ScopeContext,
  ) {
    const whereClause: Prisma.CourseWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (filters?.programId) {
      whereClause.programId = filters.programId.includes(',')
        ? { in: filters.programId.split(',') }
        : filters.programId;
    }

    if (scopeCtx?.scope === 'own') {
      const programIds = await this.getStudentProgramIds(
        tenantId,
        scopeCtx.membershipId,
      );
      if (programIds.length === 0) return [];
      whereClause.AND = [
        ...(Array.isArray(whereClause.AND) ? whereClause.AND : []),
        { programId: { in: programIds } },
      ];
    }

    if (filters?.search) {
      const search = filters.search.trim();
      if (search) {
        whereClause.AND = [
          ...(Array.isArray(whereClause.AND) ? whereClause.AND : []),
          {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          },
        ];
      }
    }

    return this.prisma.course.findMany({
      where: whereClause,
      include: {
        program: {
          select: {
            id: true,
            name: true,
            code: true,
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
        name: 'asc',
      },
    });
  }

  async findOne(tenantId: string, id: string, scopeCtx?: ScopeContext) {
    const course = await this.prisma.course.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            code: true,
            classes: {
              where: { deletedAt: null },
              select: {
                id: true,
                name: true,
                status: true,
                academicTerm: {
                  select: { name: true },
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

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (scopeCtx?.scope === 'own') {
      const programIds = await this.getStudentProgramIds(
        tenantId,
        scopeCtx.membershipId,
      );
      if (!programIds.includes(course.programId)) {
        throw new ForbiddenException('You do not have access to this course.');
      }
    }

    const teacherAssignments = await this.prisma.classInstructorCourse.findMany(
      {
        where: {
          courseId: id,
          tenantId,
          deletedAt: null,
          classInstructor: {
            deletedAt: null,
            class: { deletedAt: null },
          },
        },
        include: {
          classInstructor: {
            include: {
              class: { select: { id: true, name: true } },
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
    );

    const teachers = teacherAssignments.map((a) => ({
      membershipId: a.classInstructor.membership.id,
      userId: a.classInstructor.membership.user.id,
      firstName: a.classInstructor.membership.user.firstName,
      lastName: a.classInstructor.membership.user.lastName,
      email: a.classInstructor.membership.user.email,
      classId: a.classInstructor.class.id,
      className: a.classInstructor.class.name,
    }));

    return { ...course, teachers };
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateCourseDto,
  ) {
    const existingCourse = await this.prisma.course.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
    });

    if (!existingCourse) {
      throw new NotFoundException('Course not found');
    }

    // Validate code uniqueness if it is changing
    if (dto.code && dto.code.trim() !== existingCourse.code) {
      const duplicate = await this.prisma.course.findFirst({
        where: {
          tenantId,
          code: dto.code.trim(),
        },
      });

      if (duplicate) {
        if (duplicate.deletedAt) {
          throw new BadRequestException(
            'A deleted course with this code already exists. Please choose a different code.',
          );
        }
        throw new BadRequestException(
          'A course with this code already exists.',
        );
      }
    }

    return this.prisma.course.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code: dto.code?.trim(),
        description:
          dto.description !== undefined ? dto.description.trim() : undefined,
        credits: dto.credits !== undefined ? dto.credits : undefined,
        updatedBy: userId,
      },
    });
  }

  async remove(tenantId: string, userId: string, id: string) {
    const course = await this.prisma.course.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Block deletion if the course's program has any active or archived classes/sections
    const classesCount = await this.prisma.class.count({
      where: {
        tenantId,
        programId: course.programId,
        deletedAt: null,
      },
    });

    if (classesCount > 0) {
      throw new BadRequestException(
        'Cannot delete this course because class sections are currently scheduled for its program.',
      );
    }

    return this.prisma.course.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: userId,
      },
    });
  }
}
