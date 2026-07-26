import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';
import { getViewScope } from '@repo/permissions';
import { PrismaService } from 'nestjs-prisma';

import type { JwtPayload } from '../users/types';
import { CreateDiaryDto, UpdateDiaryDto } from './dto';

interface DiaryFilters {
  classId?: string;
  termId?: string;
  courseId?: string;
}

// Related names, included on reads so the UI can render class/course/term labels.
const DIARY_INCLUDE = {
  class: { select: { id: true, name: true } },
  course: { select: { id: true, name: true, code: true } },
  term: { select: { id: true, name: true } },
  program: { select: { id: true, name: true, code: true } },
  creator: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.DiaryInclude;

@Injectable()
export class DiaryService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Writes — the route guard enforces diary.create/edit/delete; assertInstructorOf
  // additionally enforces the caller instructs the note's class.
  // ---------------------------------------------------------------------------

  async create(tenantId: string, user: JwtPayload, dto: CreateDiaryDto) {
    await this.assertContext(tenantId, dto.termId, dto.programId, dto.classId);
    await this.assertInstructorOf(tenantId, user, dto.classId);
    if (dto.courseId) {
      await this.assertCourseInProgram(tenantId, dto.courseId, dto.programId);
    }
    if (dto.studentIds?.length) {
      await this.assertStudentsEnrolled(dto.classId, dto.studentIds);
    }

    return this.prisma.diary.create({
      data: {
        tenantId,
        termId: dto.termId,
        programId: dto.programId,
        classId: dto.classId,
        courseId: dto.courseId ?? null,
        note: dto.note,
        studentIds: dto.studentIds ?? [],
        createdBy: user.sub,
        updatedBy: user.sub,
      },
    });
  }

  async update(
    tenantId: string,
    user: JwtPayload,
    id: string,
    dto: UpdateDiaryDto,
  ) {
    const existing = await this.prisma.diary.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Diary note not found');
    await this.assertInstructorOf(tenantId, user, existing.classId);

    if (dto.courseId) {
      await this.assertCourseInProgram(tenantId, dto.courseId, existing.programId);
    }
    if (dto.studentIds?.length) {
      await this.assertStudentsEnrolled(existing.classId, dto.studentIds);
    }

    return this.prisma.diary.update({
      where: { id },
      data: {
        note: dto.note,
        courseId: dto.courseId,
        studentIds: dto.studentIds,
        updatedBy: user.sub,
      },
    });
  }

  async remove(tenantId: string, user: JwtPayload, id: string) {
    const existing = await this.prisma.diary.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Diary note not found');
    await this.assertInstructorOf(tenantId, user, existing.classId);

    return this.prisma.diary.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: user.sub },
    });
  }

  // ---------------------------------------------------------------------------
  // Reads (view / viewOwn scoping via the permission registry)
  // ---------------------------------------------------------------------------

  async findAll(tenantId: string, user: JwtPayload, filters: DiaryFilters) {
    const scope = getViewScope(user.scopes ?? [], 'diary', {
      isAdmin: user.isAdmin,
    });
    if (scope === 'none') {
      throw new ForbiddenException('You do not have access to the work diary.');
    }

    const base: Prisma.DiaryWhereInput = {
      tenantId,
      deletedAt: null,
      classId: filters.classId,
      termId: filters.termId,
      courseId: filters.courseId,
    };

    let where: Prisma.DiaryWhereInput = base;
    if (scope === 'own') {
      const own = await this.buildOwnScope(tenantId, user);
      if (!own) return [];
      where = { ...base, ...own };
    }

    return this.prisma.diary.findMany({
      where,
      include: DIARY_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, user: JwtPayload, id: string) {
    const scope = getViewScope(user.scopes ?? [], 'diary', {
      isAdmin: user.isAdmin,
    });
    if (scope === 'none') {
      throw new ForbiddenException('You do not have access to the work diary.');
    }

    let where: Prisma.DiaryWhereInput = { id, tenantId, deletedAt: null };
    if (scope === 'own') {
      const own = await this.buildOwnScope(tenantId, user);
      if (!own) throw new NotFoundException('Diary note not found');
      where = { ...where, ...own };
    }

    const diary = await this.prisma.diary.findFirst({
      where,
      include: DIARY_INCLUDE,
    });
    if (!diary) throw new NotFoundException('Diary note not found');
    return diary;
  }

  // ---------------------------------------------------------------------------
  // Form options — classes the caller may author diary notes for, each with its
  // program, term, the program's courses, and the class's active students.
  // ---------------------------------------------------------------------------

  async getOptions(tenantId: string, user: JwtPayload) {
    const scope = getViewScope(user.scopes ?? [], 'class', {
      isAdmin: user.isAdmin,
    });

    const where: Prisma.ClassWhereInput = { tenantId, deletedAt: null };
    if (!user.isAdmin && scope !== 'all') {
      // Faculty: limit to classes they instruct.
      const membershipId = await this.resolveMembershipId(tenantId, user);
      if (!membershipId) return [];
      const instructed = await this.prisma.classInstructor.findMany({
        where: { tenantMembershipId: membershipId, deletedAt: null },
        select: { classId: true },
      });
      if (!instructed.length) return [];
      where.id = { in: instructed.map((i) => i.classId) };
    }

    const classes = await this.prisma.class.findMany({
      where,
      select: {
        id: true,
        name: true,
        program: {
          select: {
            id: true,
            name: true,
            code: true,
            courses: {
              where: { deletedAt: null },
              select: { id: true, name: true, code: true },
            },
          },
        },
        academicTerm: { select: { id: true, name: true } },
        enrolments: {
          where: { status: 'ACTIVE', deletedAt: null },
          select: {
            student: {
              select: {
                id: true,
                rollNumber: true,
                membership: {
                  select: {
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return classes.map((c) => ({
      id: c.id,
      name: c.name,
      program: c.program
        ? { id: c.program.id, name: c.program.name, code: c.program.code }
        : null,
      term: c.academicTerm
        ? { id: c.academicTerm.id, name: c.academicTerm.name }
        : null,
      courses: c.program?.courses ?? [],
      students: c.enrolments.map((e) => ({
        studentProfileId: e.student.id,
        firstName: e.student.membership?.user?.firstName ?? '',
        lastName: e.student.membership?.user?.lastName ?? '',
        rollNumber: e.student.rollNumber,
      })),
    }));
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async resolveMembershipId(
    tenantId: string,
    user: JwtPayload,
  ): Promise<string | null> {
    if (user.membershipId) return user.membershipId;
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { userId: user.sub, tenantId, deletedAt: null },
      select: { id: true },
    });
    return membership?.id ?? null;
  }

  // Restrict "own" reads to notes the caller owns, OR-ing whichever contexts apply:
  //  - faculty  → notes for classes they instruct
  //  - student  → notes for their class targeted at them (or at all students)
  //  - parent   → notes for a child's class targeted at that child (or at all)
  private async buildOwnScope(
    tenantId: string,
    user: JwtPayload,
  ): Promise<Prisma.DiaryWhereInput | null> {
    const membershipId = await this.resolveMembershipId(tenantId, user);
    if (!membershipId) return null;

    const or: Prisma.DiaryWhereInput[] = [];

    // Faculty context
    const instructed = await this.prisma.classInstructor.findMany({
      where: { tenantMembershipId: membershipId, deletedAt: null },
      select: { classId: true },
    });
    if (instructed.length) {
      or.push({ classId: { in: instructed.map((i) => i.classId) } });
    }

    // Student context
    const studentProfile = await this.prisma.studentProfile.findFirst({
      where: { tenantMembershipId: membershipId, deletedAt: null },
      select: { id: true },
    });
    if (studentProfile) {
      const enrolments = await this.prisma.enrolment.findMany({
        where: {
          studentProfileId: studentProfile.id,
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { classId: true },
      });
      if (enrolments.length) {
        or.push({
          classId: { in: enrolments.map((e) => e.classId) },
          OR: [
            { studentIds: { isEmpty: true } },
            { studentIds: { has: studentProfile.id } },
          ],
        });
      }
    }

    // Parent context
    const parentProfile = await this.prisma.parentProfile.findFirst({
      where: { tenantMembershipId: membershipId, deletedAt: null },
      select: { id: true },
    });
    if (parentProfile) {
      const links = await this.prisma.studentParent.findMany({
        where: { parentProfileId: parentProfile.id },
        select: { studentProfileId: true },
      });
      const childIds = links.map((l) => l.studentProfileId);
      if (childIds.length) {
        const childEnrolments = await this.prisma.enrolment.findMany({
          where: {
            studentProfileId: { in: childIds },
            status: 'ACTIVE',
            deletedAt: null,
          },
          select: { classId: true },
        });
        if (childEnrolments.length) {
          or.push({
            classId: { in: childEnrolments.map((e) => e.classId) },
            OR: [
              { studentIds: { isEmpty: true } },
              { studentIds: { hasSome: childIds } },
            ],
          });
        }
      }
    }

    if (!or.length) return null;
    return { OR: or };
  }

  // Enforces that the caller is a ClassInstructor (deletedAt: null) of classId,
  // bypassed for admins. Required on every write since diary.create/edit/delete
  // are granted tenant-wide, not scoped per class, by the permission registry.
  private async assertInstructorOf(
    tenantId: string,
    user: JwtPayload,
    classId: string,
  ) {
    if (user.isAdmin) return;
    const membershipId = await this.resolveMembershipId(tenantId, user);
    const instructor =
      membershipId &&
      (await this.prisma.classInstructor.findFirst({
        where: { tenantMembershipId: membershipId, classId, deletedAt: null },
      }));
    if (!instructor) {
      throw new ForbiddenException(
        'You are not an instructor of this class.',
      );
    }
  }

  private async assertContext(
    tenantId: string,
    termId: string,
    programId: string,
    classId: string,
  ) {
    const [term, program, klass] = await Promise.all([
      this.prisma.academicTerm.findFirst({
        where: { id: termId, tenantId, deletedAt: null },
      }),
      this.prisma.program.findFirst({
        where: { id: programId, tenantId, deletedAt: null },
      }),
      this.prisma.class.findFirst({
        where: { id: classId, tenantId, deletedAt: null },
      }),
    ]);
    if (!term) throw new BadRequestException('Academic term not found.');
    if (!program) throw new BadRequestException('Program not found.');
    if (!klass) throw new BadRequestException('Class not found.');
    if (klass.programId !== programId) {
      throw new BadRequestException(
        'Class does not belong to the given program.',
      );
    }
  }

  private async assertCourseInProgram(
    tenantId: string,
    courseId: string,
    programId: string,
  ) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, tenantId, programId, deletedAt: null },
    });
    if (!course) {
      throw new BadRequestException('Course not found in the given program.');
    }
  }

  private async assertStudentsEnrolled(classId: string, studentIds: string[]) {
    const enrolled = await this.prisma.enrolment.findMany({
      where: {
        classId,
        studentProfileId: { in: studentIds },
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { studentProfileId: true },
      distinct: ['studentProfileId'],
    });
    if (enrolled.length !== new Set(studentIds).size) {
      throw new BadRequestException(
        'One or more students are not actively enrolled in this class.',
      );
    }
  }
}
