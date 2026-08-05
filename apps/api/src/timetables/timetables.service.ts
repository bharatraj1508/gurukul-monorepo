import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from 'nestjs-prisma';

import {
  DuplicateTimetableDto,
  GenerateTimetableDto,
  PreflightTimetableDto,
  RenameTimetableDto,
} from './dto';
import { TimetableSnapshotService } from './solver/timetable-snapshot.service';
import { SolverJobPayload } from './solver/timetable-solver.contracts';
import { TimetableSolverService } from './solver/timetable-solver.service';
import {
  INFEASIBLE_HINT_CODE,
  PERIOD_SLOT_KIND,
  TIMETABLE_STATUS,
} from './timetables.constants';
import { toIsoDate } from './timetables.util';

const LIST_INCLUDE = {
  academicTerm: { select: { id: true, name: true } },
  periodTemplate: { select: { id: true, name: true } },
  _count: { select: { slots: true } },
} as const;

const SLOT_INCLUDE = {
  class: { select: { id: true, name: true } },
  course: { select: { id: true, name: true } },
  teacher: {
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
  room: { select: { id: true, name: true, type: true } },
} as const;

@Injectable()
export class TimetablesService {
  private readonly logger = new Logger(TimetablesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotService: TimetableSnapshotService,
    private readonly solverService: TimetableSolverService,
  ) {}

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  async findAll(
    tenantId: string,
    params?: { academicTermId?: string; status?: string },
  ) {
    return this.prisma.timetable.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(params?.academicTermId && {
          academicTermId: params.academicTermId,
        }),
        ...(params?.status && { status: params.status }),
      },
      include: LIST_INCLUDE,
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    let timetable = await this.fetchDetail(tenantId, id);
    if (!timetable) throw new NotFoundException(`Timetable ${id} not found.`);

    // Lazy reconciliation: a GENERATING row whose completion event was missed
    // is re-synced against the job's real state before being returned.
    if (timetable.status === TIMETABLE_STATUS.GENERATING) {
      await this.solverService.reconcile({
        id: timetable.id,
        tenantId: timetable.tenantId,
        jobId: timetable.jobId,
        createdAt: timetable.createdAt,
      });
      timetable = (await this.fetchDetail(tenantId, id)) ?? timetable;
    }

    return timetable;
  }

  async findSlots(tenantId: string, id: string) {
    await this.getOwned(tenantId, id);

    const slots = await this.prisma.timetableSlot.findMany({
      where: { timetableId: id, tenantId },
      include: SLOT_INCLUDE,
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
    });

    return slots.map((slot) => ({
      id: slot.id,
      classId: slot.classId,
      className: slot.class.name,
      dayOfWeek: slot.dayOfWeek,
      periodNumber: slot.periodNumber,
      course: slot.course,
      teacher: slot.teacher
        ? {
            membershipId: slot.teacher.id,
            name: `${slot.teacher.user.firstName} ${slot.teacher.user.lastName}`,
          }
        : null,
      room: slot.room,
    }));
  }

  // ---------------------------------------------------------------------------
  // Preflight + generate
  // ---------------------------------------------------------------------------

  async preflight(tenantId: string, dto: PreflightTimetableDto) {
    const { issues } = await this.snapshotService.build(tenantId, dto);
    return { issues };
  }

  async generate(tenantId: string, userId: string, dto: GenerateTimetableDto) {
    const { payload, issues } = await this.snapshotService.build(tenantId, dto);

    const errors = issues.filter((issue) => issue.severity === 'ERROR');
    if (errors.length > 0) {
      throw new UnprocessableEntityException({
        message: 'Preflight failed. Resolve the reported issues and try again.',
        issues,
      });
    }

    const jobId = randomUUID();
    const timetable = await this.prisma.$transaction(async (tx) => {
      // Version numbering must span soft-deleted rows: the
      // (tenantId, academicTermId, version) unique still counts them.
      const { _max } = await tx.timetable.aggregate({
        where: { tenantId, academicTermId: dto.academicTermId },
        _max: { version: true },
      });
      const version = (_max.version ?? 0) + 1;

      const created = await tx.timetable.create({
        data: {
          tenantId,
          academicTermId: dto.academicTermId,
          periodTemplateId: dto.periodTemplateId,
          name: dto.name?.trim() || `Timetable v${version}`,
          version,
          status: TIMETABLE_STATUS.GENERATING,
          jobId,
          createdBy: userId,
        },
      });

      const fullPayload: SolverJobPayload = {
        ...payload,
        timetableId: created.id,
      };
      return tx.timetable.update({
        where: { id: created.id },
        data: {
          inputSnapshot: fullPayload as unknown as Prisma.InputJsonValue,
        },
      });
    });

    try {
      await this.solverService.enqueue(
        timetable.inputSnapshot as unknown as SolverJobPayload,
        jobId,
      );
    } catch (err) {
      // The row must not sit in GENERATING forever if Redis was unreachable.
      this.logger.error(
        `Failed to enqueue solver job for timetable ${timetable.id}`,
        err instanceof Error ? err.stack : String(err),
      );
      await this.prisma.timetable.updateMany({
        where: { id: timetable.id, status: TIMETABLE_STATUS.GENERATING },
        data: {
          status: TIMETABLE_STATUS.FAILED,
          failureHints: [
            {
              code: INFEASIBLE_HINT_CODE.GENERATION_INTERRUPTED,
              message:
                'The generation job could not be queued. Check that the solver service is running and try again.',
              params: {},
            },
          ] as unknown as Prisma.InputJsonValue,
        },
      });
      throw err;
    }

    return { timetableId: timetable.id, warnings: issues };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async duplicate(
    tenantId: string,
    id: string,
    userId: string,
    dto: DuplicateTimetableDto,
  ) {
    const source = await this.prisma.timetable.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { slots: true },
    });
    if (!source) throw new NotFoundException(`Timetable ${id} not found.`);
    if (source.status === TIMETABLE_STATUS.GENERATING) {
      throw new ConflictException(
        'This timetable is still generating and cannot be duplicated yet.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const { _max } = await tx.timetable.aggregate({
        where: { tenantId, academicTermId: source.academicTermId },
        _max: { version: true },
      });
      const version = (_max.version ?? 0) + 1;

      const copy = await tx.timetable.create({
        data: {
          tenantId,
          academicTermId: source.academicTermId,
          periodTemplateId: source.periodTemplateId,
          name: dto.name?.trim() || `${source.name} (copy)`,
          version,
          status: TIMETABLE_STATUS.DRAFT,
          inputSnapshot: this.copyJson(source.inputSnapshot),
          violations: this.copyJson(source.violations),
          solverStats: this.copyJson(source.solverStats),
          createdBy: userId,
        },
      });

      if (source.slots.length > 0) {
        await tx.timetableSlot.createMany({
          data: source.slots.map((slot) => ({
            tenantId,
            timetableId: copy.id,
            classId: slot.classId,
            dayOfWeek: slot.dayOfWeek,
            periodNumber: slot.periodNumber,
            courseId: slot.courseId,
            teacherMembershipId: slot.teacherMembershipId,
            roomId: slot.roomId,
          })),
        });
      }

      return copy;
    });
  }

  async rename(
    tenantId: string,
    id: string,
    userId: string,
    dto: RenameTimetableDto,
  ) {
    const timetable = await this.getOwned(tenantId, id);
    return this.prisma.timetable.update({
      where: { id: timetable.id },
      data: { name: dto.name.trim(), updatedBy: userId },
    });
  }

  async remove(tenantId: string, id: string, userId: string) {
    const timetable = await this.getOwned(tenantId, id);
    if (timetable.status === TIMETABLE_STATUS.PUBLISHED) {
      throw new ConflictException(
        'The published timetable cannot be deleted. Publish another version first.',
      );
    }

    await this.prisma.timetable.update({
      where: { id: timetable.id },
      data: { deletedAt: new Date(), updatedBy: userId },
    });

    return { message: 'Timetable deleted successfully.' };
  }

  /**
   * Publishes a DRAFT (go-live) or ARCHIVED (rollback) version, archiving the
   * currently published one. Serialized per term with a pg advisory lock so
   * two concurrent publishes cannot both end up PUBLISHED.
   */
  async publish(tenantId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const ref = await tx.timetable.findFirst({
        where: { id, tenantId, deletedAt: null },
        select: { academicTermId: true },
      });
      if (!ref) throw new NotFoundException(`Timetable ${id} not found.`);

      // Use $executeRaw, not $queryRaw: pg_advisory_xact_lock returns SQL `void`,
      // which the pg driver adapter cannot decode as a result column
      // (UnsupportedNativeDataType). executeRaw runs the statement without
      // decoding a typed result set.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ref.academicTermId}))`;

      // Re-read under the lock — status may have changed while waiting.
      const target = await tx.timetable.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { periodTemplate: { include: { slots: true } } },
      });
      if (!target) throw new NotFoundException(`Timetable ${id} not found.`);
      if (
        target.status !== TIMETABLE_STATUS.DRAFT &&
        target.status !== TIMETABLE_STATUS.ARCHIVED
      ) {
        throw new ConflictException(
          `Only draft or archived timetables can be published (current status: ${target.status}).`,
        );
      }

      const now = new Date();
      const warnings: Record<string, unknown>[] = [];

      const current = await tx.timetable.findFirst({
        where: {
          tenantId,
          academicTermId: target.academicTermId,
          status: TIMETABLE_STATUS.PUBLISHED,
          deletedAt: null,
          id: { not: target.id },
        },
        select: { id: true, name: true, version: true },
      });

      if (current) {
        await tx.timetable.update({
          where: { id: current.id },
          data: {
            status: TIMETABLE_STATUS.ARCHIVED,
            archivedAt: now,
            updatedBy: userId,
          },
        });

        // Substitutions do not carry across versions — warn about the ones
        // that were scheduled for dates still ahead.
        const today = new Date(`${toIsoDate(now)}T00:00:00.000Z`);
        const futureSubs = await tx.timetableSubstitution.findMany({
          where: {
            tenantId,
            deletedAt: null,
            date: { gte: today },
            slot: { timetableId: current.id },
          },
          select: { id: true, date: true, timetableSlotId: true },
        });
        if (futureSubs.length > 0) {
          warnings.push({
            code: 'FUTURE_SUBSTITUTIONS_ARCHIVED',
            message: `${futureSubs.length} future-dated substitution(s) on the archived version "${current.name}" will no longer apply.`,
            substitutions: futureSubs.map((s) => ({
              id: s.id,
              timetableSlotId: s.timetableSlotId,
              date: toIsoDate(s.date),
            })),
          });
        }
      }

      const published = await tx.timetable.update({
        where: { id: target.id },
        data: {
          status: TIMETABLE_STATUS.PUBLISHED,
          publishedAt: now,
          publishedBy: userId,
          archivedAt: null,
          updatedBy: userId,
        },
      });

      // Uncovered class-cells (free periods) are allowed — inform, don't block.
      const classCount = await tx.class.count({
        where: {
          tenantId,
          academicTermId: target.academicTermId,
          deletedAt: null,
          status: 'ACTIVE',
        },
      });
      const periodCount = target.periodTemplate.slots.filter(
        (s) => s.kind === PERIOD_SLOT_KIND.PERIOD,
      ).length;
      const expectedCells =
        classCount * target.periodTemplate.workingDays.length * periodCount;
      const placed = await tx.timetableSlot.count({
        where: { timetableId: target.id },
      });
      const uncovered = Math.max(0, expectedCells - placed);
      if (uncovered > 0) {
        warnings.push({
          code: 'UNCOVERED_CELLS',
          message: `${uncovered} class period cell(s) have no scheduled lesson.`,
          count: uncovered,
        });
      }

      return { timetable: published, warnings };
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private fetchDetail(tenantId: string, id: string) {
    return this.prisma.timetable.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: LIST_INCLUDE,
    });
  }

  private async getOwned(tenantId: string, id: string) {
    const timetable = await this.prisma.timetable.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!timetable) throw new NotFoundException(`Timetable ${id} not found.`);
    return timetable;
  }

  private copyJson(value: Prisma.JsonValue | null) {
    return value === null ? undefined : (value as Prisma.InputJsonValue);
  }
}
