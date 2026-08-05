import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from 'nestjs-prisma';

import {
  GENERATION_STALE_AFTER_MS,
  INFEASIBLE_HINT_CODE,
  TIMETABLE_SOLVER_JOB,
  TIMETABLE_SOLVER_QUEUE,
  TIMETABLE_STATUS,
} from '../timetables.constants';
import { SolverJobPayload, SolverResult } from './timetable-solver.contracts';

interface GeneratingTimetableRef {
  id: string;
  tenantId: string;
  jobId: string | null;
  createdAt: Date;
}

/**
 * Owns the Nest side of the solve pipeline: enqueueing jobs for the Python
 * worker, persisting results idempotently, and reconciling GENERATING rows
 * whose events were missed (process restarts, Redis evictions).
 *
 * There is intentionally no @Processor for this queue — the Python worker is
 * its only consumer; Nest only observes queue events.
 */
@Injectable()
export class TimetableSolverService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TimetableSolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(TIMETABLE_SOLVER_QUEUE)
    private readonly queue: Queue<SolverJobPayload, SolverResult>,
  ) {}

  async onApplicationBootstrap() {
    // Sweep rows stuck in GENERATING from a previous process. Never blocks or
    // crashes startup — Redis may simply not be up yet.
    try {
      await this.reconcileAll();
    } catch (err) {
      this.logger.warn(
        `Timetable reconciliation sweep failed at bootstrap: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async enqueue(payload: SolverJobPayload, jobId: string): Promise<void> {
    await this.queue.add(TIMETABLE_SOLVER_JOB, payload, { jobId });
  }

  // ---------------------------------------------------------------------------
  // Result persistence (idempotent)
  // ---------------------------------------------------------------------------

  /**
   * Persists a solver result. Safe to call multiple times and with stale
   * results: requires the event's jobId to match the row's current jobId, and
   * the row to still be GENERATING (status-guarded updateMany).
   */
  async handleSolverCompletion(
    jobId: string,
    result: SolverResult | null | undefined,
  ): Promise<void> {
    if (!result || typeof result !== 'object' || !result.timetableId) {
      this.logger.error(
        `Solver job ${jobId} completed without a parseable result.`,
      );
      await this.failByJobId(jobId, 'The solver returned no result.');
      return;
    }

    const timetable = await this.prisma.timetable.findFirst({
      where: { id: result.timetableId, deletedAt: null },
      select: { id: true, tenantId: true, jobId: true },
    });
    if (!timetable) return; // deleted mid-generation — drop silently
    if (timetable.jobId !== jobId) {
      this.logger.warn(
        `Dropping stale solver result for timetable ${timetable.id} (job ${jobId}).`,
      );
      return;
    }

    if (result.status === 'OPTIMAL' || result.status === 'FEASIBLE') {
      await this.persistDraft(timetable.id, timetable.tenantId, result);
      return;
    }

    // INFEASIBLE / ERROR are successful jobs carrying hints — surface them.
    const hints = result.infeasibleHints?.length
      ? result.infeasibleHints
      : [
          {
            code: INFEASIBLE_HINT_CODE.UNKNOWN,
            message:
              result.error ?? 'The solver could not find a feasible timetable.',
            params: {},
          },
        ];
    await this.prisma.timetable.updateMany({
      where: { id: timetable.id, status: TIMETABLE_STATUS.GENERATING },
      data: {
        status: TIMETABLE_STATUS.FAILED,
        failureHints: hints as unknown as Prisma.InputJsonValue,
        solverStats: (result.stats ?? {}) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async handleSolverFailure(jobId: string, failedReason?: string) {
    await this.failByJobId(
      jobId,
      failedReason ?? 'Timetable generation failed unexpectedly.',
    );
  }

  private async persistDraft(
    timetableId: string,
    tenantId: string,
    result: SolverResult,
  ) {
    await this.prisma.$transaction(async (tx) => {
      // Status guard doubles as the idempotency latch: a duplicate event or a
      // concurrent reconciliation loses this updateMany and aborts silently.
      const { count } = await tx.timetable.updateMany({
        where: { id: timetableId, status: TIMETABLE_STATUS.GENERATING },
        data: {
          status: TIMETABLE_STATUS.DRAFT,
          violations: (result.violations ??
            []) as unknown as Prisma.InputJsonValue,
          solverStats: (result.stats ?? {}) as unknown as Prisma.InputJsonValue,
        },
      });
      if (count === 0) return;

      await tx.timetableSlot.deleteMany({ where: { timetableId } });
      if (result.slots.length > 0) {
        await tx.timetableSlot.createMany({
          data: result.slots.map((slot) => ({
            tenantId,
            timetableId,
            classId: slot.classId,
            dayOfWeek: slot.dayOfWeek,
            periodNumber: slot.periodNumber,
            courseId: slot.courseId,
            teacherMembershipId: slot.teacherId ?? null,
            roomId: slot.roomId ?? null,
          })),
        });
      }
    });
  }

  private async failByJobId(jobId: string, message: string) {
    await this.prisma.timetable.updateMany({
      where: {
        jobId,
        status: TIMETABLE_STATUS.GENERATING,
        deletedAt: null,
      },
      data: {
        status: TIMETABLE_STATUS.FAILED,
        failureHints: [
          { code: INFEASIBLE_HINT_CODE.UNKNOWN, message, params: {} },
        ] as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Reconciliation (bootstrap sweep + lazy, from GET /timetables/:id)
  // ---------------------------------------------------------------------------

  async reconcileAll(): Promise<void> {
    const generating = await this.prisma.timetable.findMany({
      where: { status: TIMETABLE_STATUS.GENERATING, deletedAt: null },
      select: { id: true, tenantId: true, jobId: true, createdAt: true },
    });
    for (const timetable of generating) {
      await this.reconcile(timetable);
    }
  }

  /** Re-syncs one GENERATING row against its job's actual state in Redis. */
  async reconcile(timetable: GeneratingTimetableRef): Promise<void> {
    if (!timetable.jobId) {
      await this.failIfStale(timetable);
      return;
    }

    let job;
    try {
      job = await this.queue.getJob(timetable.jobId);
    } catch (err) {
      this.logger.warn(
        `Could not fetch solver job ${timetable.jobId}: ${err instanceof Error ? err.message : err}`,
      );
      return;
    }

    if (!job) {
      await this.failIfStale(timetable);
      return;
    }

    const state = await job.getState();
    if (state === 'completed') {
      await this.handleSolverCompletion(
        timetable.jobId,
        job.returnvalue as SolverResult,
      );
    } else if (state === 'failed') {
      await this.handleSolverFailure(timetable.jobId, job.failedReason);
    }
    // waiting / active / delayed — still legitimately in flight.
  }

  /** Job vanished from Redis: fail the row once it is older than the window. */
  private async failIfStale(timetable: GeneratingTimetableRef) {
    if (
      Date.now() - timetable.createdAt.getTime() <=
      GENERATION_STALE_AFTER_MS
    ) {
      return;
    }
    await this.prisma.timetable.updateMany({
      where: { id: timetable.id, status: TIMETABLE_STATUS.GENERATING },
      data: {
        status: TIMETABLE_STATUS.FAILED,
        failureHints: [
          {
            code: INFEASIBLE_HINT_CODE.GENERATION_INTERRUPTED,
            message:
              'Generation was interrupted and its job is no longer in the queue. Please generate again.',
            params: {},
          },
        ] as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
