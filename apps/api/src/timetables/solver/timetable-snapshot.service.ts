import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from 'nestjs-prisma';

import { PreflightTimetableDto } from '../dto';
import {
  PERIOD_SLOT_KIND,
  PREFLIGHT_CODE,
  PreflightCode,
  SOLVER_CONTRACT_SCHEMA_VERSION,
  SOLVER_DEFAULT_TIME_LIMIT_SECONDS,
  SOLVER_MAX_TIME_LIMIT_SECONDS,
} from '../timetables.constants';
import {
  SolverJobPayload,
  SolverLesson,
  SolverTeacher,
} from './timetable-solver.contracts';

export type PreflightSeverity = 'ERROR' | 'WARNING';

export interface PreflightIssue {
  code: PreflightCode;
  severity: PreflightSeverity;
  message: string;
  params: Record<string, unknown>;
}

export interface SnapshotBuildResult {
  /** Payload minus timetableId — the caller stamps it after creating the row. */
  payload: Omit<SolverJobPayload, 'timetableId'>;
  issues: PreflightIssue[];
}

const SOLVER_WEIGHTS = { spread: 10, teacherBalance: 1 } as const;

/**
 * Builds the fully denormalized solver input snapshot and runs preflight
 * validation over it. The same build feeds both POST /timetables/preflight
 * (dry-run) and POST /timetables/generate (blocks on ERROR issues).
 */
@Injectable()
export class TimetableSnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    tenantId: string,
    dto: PreflightTimetableDto & { timeLimitSeconds?: number },
  ): Promise<SnapshotBuildResult> {
    const term = await this.prisma.academicTerm.findFirst({
      where: { id: dto.academicTermId, tenantId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!term) {
      throw new NotFoundException(
        `Academic term ${dto.academicTermId} not found.`,
      );
    }

    const template = await this.prisma.periodTemplate.findFirst({
      where: { id: dto.periodTemplateId, tenantId, deletedAt: null },
      include: { slots: { orderBy: { sortOrder: 'asc' as const } } },
    });
    if (!template) {
      throw new NotFoundException(
        `Period template ${dto.periodTemplateId} not found.`,
      );
    }

    const workingDays = [...template.workingDays].sort((a, b) => a - b);
    const periodNumbers = template.slots
      .filter(
        (s) => s.kind === PERIOD_SLOT_KIND.PERIOD && s.periodNumber != null,
      )
      .map((s) => s.periodNumber as number)
      .sort((a, b) => a - b);
    const gridCapacity = workingDays.length * periodNumbers.length;

    const classes = await this.prisma.class.findMany({
      where: {
        tenantId,
        academicTermId: term.id,
        deletedAt: null,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            enrolments: { where: { status: 'ACTIVE', deletedAt: null } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    const classIds = classes.map((c) => c.id);

    const allocations = await this.prisma.courseAllocation.findMany({
      where: { tenantId, classId: { in: classIds }, deletedAt: null },
      include: { course: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const cicRows = await this.prisma.classInstructorCourse.findMany({
      where: {
        tenantId,
        deletedAt: null,
        classInstructor: { deletedAt: null, classId: { in: classIds } },
      },
      select: {
        courseId: true,
        createdAt: true,
        id: true,
        classInstructor: {
          select: {
            classId: true,
            isPrimary: true,
            tenantMembershipId: true,
            createdAt: true,
          },
        },
      },
    });

    const issues: PreflightIssue[] = [];
    const classById = new Map(classes.map((c) => [c.id, c]));

    // --- Lessons: resolve the teacher for each (class, course) from CIC -----
    const lessons: SolverLesson[] = [];
    for (const allocation of allocations) {
      const klass = classById.get(allocation.classId);
      if (!klass) continue;

      const candidates = cicRows
        .filter(
          (row) =>
            row.classInstructor.classId === allocation.classId &&
            row.courseId === allocation.courseId,
        )
        .sort(
          (a, b) =>
            Number(b.classInstructor.isPrimary) -
              Number(a.classInstructor.isPrimary) ||
            a.createdAt.getTime() - b.createdAt.getTime() ||
            a.id.localeCompare(b.id),
        );

      if (candidates.length === 0) {
        issues.push({
          code: PREFLIGHT_CODE.MISSING_INSTRUCTOR,
          severity: 'ERROR',
          message: `No instructor is assigned to ${allocation.course.name} in ${klass.name}.`,
          params: {
            classId: klass.id,
            className: klass.name,
            courseId: allocation.courseId,
            courseName: allocation.course.name,
          },
        });
        continue;
      }

      const chosen = candidates[0];
      if (candidates.length > 1) {
        issues.push({
          code: PREFLIGHT_CODE.AMBIGUOUS_INSTRUCTOR,
          severity: 'WARNING',
          message: `${allocation.course.name} in ${klass.name} has ${candidates.length} instructors; the ${chosen.classInstructor.isPrimary ? 'primary' : 'oldest'} assignment was used.`,
          params: {
            classId: klass.id,
            className: klass.name,
            courseId: allocation.courseId,
            courseName: allocation.course.name,
            candidateMembershipIds: candidates.map(
              (c) => c.classInstructor.tenantMembershipId,
            ),
            chosenMembershipId: chosen.classInstructor.tenantMembershipId,
          },
        });
      }

      lessons.push({
        id: allocation.id,
        classId: allocation.classId,
        courseId: allocation.courseId,
        courseName: allocation.course.name,
        teacherId: chosen.classInstructor.tenantMembershipId,
        periodsPerWeek: allocation.periodsPerWeek,
        blockSize: allocation.consecutiveBlockSize,
        roomId: allocation.roomId,
        roomType: allocation.roomType,
      });
    }

    // --- Teachers referenced by the resolved lessons -------------------------
    const teacherIds = [...new Set(lessons.map((l) => l.teacherId))];
    const memberships = teacherIds.length
      ? await this.prisma.tenantMembership.findMany({
          where: { id: { in: teacherIds } },
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
          },
        })
      : [];
    const constraints = teacherIds.length
      ? await this.prisma.teacherConstraint.findMany({
          where: {
            tenantId,
            tenantMembershipId: { in: teacherIds },
            deletedAt: null,
          },
        })
      : [];
    const constraintByTeacher = new Map(
      constraints.map((c) => [c.tenantMembershipId, c]),
    );

    const teachers: SolverTeacher[] = memberships.map((m) => {
      const constraint = constraintByTeacher.get(m.id);
      return {
        id: m.id,
        name: `${m.user.firstName} ${m.user.lastName}`,
        maxPeriodsPerDay: constraint?.maxPeriodsPerDay ?? null,
        maxPeriodsPerWeek: constraint?.maxPeriodsPerWeek ?? null,
        maxConsecutivePeriods: constraint?.maxConsecutivePeriods ?? null,
        availability:
          (constraint?.availability as Record<string, number[]> | null) ?? null,
      };
    });

    const rooms = await this.prisma.room.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true, type: true, capacity: true },
      orderBy: { name: 'asc' },
    });

    // --- Preflight checks -----------------------------------------------------
    if (allocations.length === 0) {
      issues.push({
        code: PREFLIGHT_CODE.NO_ALLOCATIONS,
        severity: 'ERROR',
        message: 'No course allocations are configured for this term.',
        params: {},
      });
    }
    for (const klass of classes) {
      if (!allocations.some((a) => a.classId === klass.id)) {
        issues.push({
          code: PREFLIGHT_CODE.NO_ALLOCATIONS,
          severity: 'WARNING',
          message: `${klass.name} has no course allocations and will be left empty.`,
          params: { classId: klass.id, className: klass.name },
        });
      }
    }

    for (const klass of classes) {
      const allocated = allocations
        .filter((a) => a.classId === klass.id)
        .reduce((sum, a) => sum + a.periodsPerWeek, 0);
      if (allocated > gridCapacity) {
        issues.push({
          code: PREFLIGHT_CODE.CLASS_OVERALLOCATED,
          severity: 'ERROR',
          message: `${klass.name} has ${allocated} periods allocated but the grid only has ${gridCapacity}.`,
          params: {
            classId: klass.id,
            className: klass.name,
            allocated,
            capacity: gridCapacity,
          },
        });
      }
    }

    for (const teacher of teachers) {
      const demand = lessons
        .filter((l) => l.teacherId === teacher.id)
        .reduce((sum, l) => sum + l.periodsPerWeek, 0);
      const capacity = this.teacherCapacity(
        teacher,
        workingDays,
        periodNumbers,
      );
      if (demand > capacity) {
        issues.push({
          code: PREFLIGHT_CODE.TEACHER_OVERLOADED,
          severity: 'ERROR',
          message: `${teacher.name} is assigned ${demand} periods/week but can teach at most ${capacity}.`,
          params: {
            teacherId: teacher.id,
            teacherName: teacher.name,
            demand,
            capacity,
          },
        });
      }
    }

    for (const lesson of lessons) {
      const klass = classById.get(lesson.classId);
      const studentCount = klass?._count.enrolments ?? 0;
      if (
        lesson.roomType &&
        !rooms.some(
          (r) => r.type === lesson.roomType && r.capacity >= studentCount,
        )
      ) {
        issues.push({
          code: PREFLIGHT_CODE.ROOM_TYPE_MISSING,
          severity: 'ERROR',
          message: `${lesson.courseName} in ${klass?.name ?? lesson.classId} needs a ${lesson.roomType} room${studentCount ? ` with capacity ≥ ${studentCount}` : ''}, but none exists.`,
          params: {
            classId: lesson.classId,
            courseId: lesson.courseId,
            roomType: lesson.roomType,
            studentCount,
          },
        });
      }

      if (
        lesson.blockSize < 1 ||
        lesson.periodsPerWeek % lesson.blockSize !== 0 ||
        lesson.blockSize > periodNumbers.length
      ) {
        issues.push({
          code: PREFLIGHT_CODE.BLOCK_SIZE_INVALID,
          severity: 'ERROR',
          message: `${lesson.courseName} in ${klass?.name ?? lesson.classId} has an impossible block size of ${lesson.blockSize} (for ${lesson.periodsPerWeek} periods/week over ${periodNumbers.length} daily periods).`,
          params: {
            classId: lesson.classId,
            courseId: lesson.courseId,
            blockSize: lesson.blockSize,
            periodsPerWeek: lesson.periodsPerWeek,
          },
        });
      }
    }

    const payload: Omit<SolverJobPayload, 'timetableId'> = {
      schemaVersion: SOLVER_CONTRACT_SCHEMA_VERSION,
      tenantId,
      grid: { workingDays, periodNumbers },
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        studentCount: c._count.enrolments,
      })),
      teachers,
      rooms,
      lessons,
      weights: { ...SOLVER_WEIGHTS },
      limits: { timeLimitSeconds: this.resolveTimeLimit(dto.timeLimitSeconds) },
    };

    return { payload, issues };
  }

  /** Max periods/week a teacher can physically cover given caps + availability. */
  private teacherCapacity(
    teacher: SolverTeacher,
    workingDays: number[],
    periodNumbers: number[],
  ): number {
    const gridCapacity = workingDays.length * periodNumbers.length;
    const periodSet = new Set(periodNumbers);

    let availabilityCap = Infinity;
    if (teacher.availability) {
      availabilityCap = workingDays.reduce((sum, day) => {
        const allowed = teacher.availability?.[String(day)];
        if (!allowed) return sum + periodNumbers.length;
        return sum + allowed.filter((p) => periodSet.has(p)).length;
      }, 0);
    }

    const dayCap =
      teacher.maxPeriodsPerDay != null
        ? teacher.maxPeriodsPerDay * workingDays.length
        : Infinity;
    const weekCap = teacher.maxPeriodsPerWeek ?? Infinity;

    return Math.min(gridCapacity, availabilityCap, dayCap, weekCap);
  }

  /** min(request, SOLVER_TIME_LIMIT_SECONDS env, hard cap), floored at 5s. */
  private resolveTimeLimit(requested?: number): number {
    const envRaw = Number(process.env.SOLVER_TIME_LIMIT_SECONDS);
    const envLimit =
      Number.isFinite(envRaw) && envRaw > 0
        ? envRaw
        : SOLVER_DEFAULT_TIME_LIMIT_SECONDS;
    return Math.max(
      5,
      Math.min(requested ?? envLimit, envLimit, SOLVER_MAX_TIME_LIMIT_SECONDS),
    );
  }
}
