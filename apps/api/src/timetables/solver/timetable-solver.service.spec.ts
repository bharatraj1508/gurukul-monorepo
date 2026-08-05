import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from 'nestjs-prisma';

import {
  GENERATION_STALE_AFTER_MS,
  INFEASIBLE_HINT_CODE,
  TIMETABLE_SOLVER_JOB,
  TIMETABLE_SOLVER_QUEUE,
  TIMETABLE_STATUS,
} from '../timetables.constants';
import { SolverResult } from './timetable-solver.contracts';
import { TimetableSolverService } from './timetable-solver.service';

const TENANT_ID = 'tenant-1';
const TIMETABLE_ID = 'tt-1';
const JOB_ID = 'job-1';

function feasibleResult(overrides: Partial<SolverResult> = {}): SolverResult {
  return {
    schemaVersion: 1,
    timetableId: TIMETABLE_ID,
    status: 'FEASIBLE',
    slots: [
      {
        classId: 'class-1',
        dayOfWeek: 1,
        periodNumber: 1,
        courseId: 'course-1',
        teacherId: 'teacher-1',
        roomId: null,
        allocationId: 'alloc-1',
      },
    ],
    violations: [],
    infeasibleHints: [],
    stats: {
      solverStatus: 'FEASIBLE',
      objectiveValue: 0,
      wallTimeMs: 10,
      conflicts: 0,
      branches: 0,
    },
    ...overrides,
  };
}

describe('TimetableSolverService', () => {
  let service: TimetableSolverService;
  let prisma: {
    timetable: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
    timetableSlot: { deleteMany: jest.Mock; createMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let queue: { add: jest.Mock; getJob: jest.Mock };

  beforeEach(async () => {
    prisma = {
      timetable: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      timetableSlot: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));

    queue = { add: jest.fn(), getJob: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableSolverService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(TIMETABLE_SOLVER_QUEUE), useValue: queue },
      ],
    }).compile();

    service = moduleRef.get(TimetableSolverService);
  });

  describe('enqueue', () => {
    it('adds the job under the caller-supplied jobId', async () => {
      const payload = { timetableId: TIMETABLE_ID } as never;
      await service.enqueue(payload, JOB_ID);
      expect(queue.add).toHaveBeenCalledWith(
        TIMETABLE_SOLVER_JOB,
        payload,
        expect.objectContaining({ jobId: JOB_ID }),
      );
    });
  });

  describe('handleSolverCompletion', () => {
    it('persists a feasible result as a DRAFT with its slots', async () => {
      prisma.timetable.findFirst.mockResolvedValue({
        id: TIMETABLE_ID,
        tenantId: TENANT_ID,
        jobId: JOB_ID,
      });

      await service.handleSolverCompletion(JOB_ID, feasibleResult());

      expect(prisma.timetable.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TIMETABLE_ID, status: TIMETABLE_STATUS.GENERATING },
          data: expect.objectContaining({ status: TIMETABLE_STATUS.DRAFT }),
        }),
      );
      expect(prisma.timetableSlot.deleteMany).toHaveBeenCalledWith({
        where: { timetableId: TIMETABLE_ID },
      });
      expect(prisma.timetableSlot.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              timetableId: TIMETABLE_ID,
              tenantId: TENANT_ID,
              classId: 'class-1',
              teacherMembershipId: 'teacher-1',
              roomId: null,
            }),
          ],
        }),
      );
    });

    it('drops a stale result whose jobId no longer matches the row', async () => {
      prisma.timetable.findFirst.mockResolvedValue({
        id: TIMETABLE_ID,
        tenantId: TENANT_ID,
        jobId: 'a-newer-job',
      });

      await service.handleSolverCompletion(JOB_ID, feasibleResult());

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.timetableSlot.createMany).not.toHaveBeenCalled();
    });

    it('is idempotent: a duplicate event that loses the status guard writes no slots', async () => {
      prisma.timetable.findFirst.mockResolvedValue({
        id: TIMETABLE_ID,
        tenantId: TENANT_ID,
        jobId: JOB_ID,
      });
      // Row already flipped to DRAFT by the first event → updateMany matches nothing.
      prisma.timetable.updateMany.mockResolvedValue({ count: 0 });

      await service.handleSolverCompletion(JOB_ID, feasibleResult());

      expect(prisma.timetableSlot.deleteMany).not.toHaveBeenCalled();
      expect(prisma.timetableSlot.createMany).not.toHaveBeenCalled();
    });

    it('marks the row FAILED with the solver hints on INFEASIBLE', async () => {
      prisma.timetable.findFirst.mockResolvedValue({
        id: TIMETABLE_ID,
        tenantId: TENANT_ID,
        jobId: JOB_ID,
      });

      const hint = {
        code: INFEASIBLE_HINT_CODE.TEACHER_OVERLOADED,
        message: 'Mr Rao needs 34 periods but is capped at 30.',
        params: { teacherId: 'teacher-1' },
      };
      await service.handleSolverCompletion(
        JOB_ID,
        feasibleResult({ status: 'INFEASIBLE', infeasibleHints: [hint] }),
      );

      expect(prisma.timetable.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TIMETABLE_ID, status: TIMETABLE_STATUS.GENERATING },
          data: expect.objectContaining({
            status: TIMETABLE_STATUS.FAILED,
            failureHints: [hint],
          }),
        }),
      );
      expect(prisma.timetableSlot.createMany).not.toHaveBeenCalled();
    });

    it('synthesizes an UNKNOWN hint when INFEASIBLE carries none', async () => {
      prisma.timetable.findFirst.mockResolvedValue({
        id: TIMETABLE_ID,
        tenantId: TENANT_ID,
        jobId: JOB_ID,
      });

      await service.handleSolverCompletion(
        JOB_ID,
        feasibleResult({
          status: 'ERROR',
          infeasibleHints: [],
          error: 'boom',
        }),
      );

      const call = prisma.timetable.updateMany.mock.calls[0][0];
      expect(call.data.status).toBe(TIMETABLE_STATUS.FAILED);
      expect(call.data.failureHints[0].code).toBe(INFEASIBLE_HINT_CODE.UNKNOWN);
      expect(call.data.failureHints[0].message).toBe('boom');
    });

    it('fails the row by jobId when the result is unparseable', async () => {
      await service.handleSolverCompletion(JOB_ID, null);

      expect(prisma.timetable.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            jobId: JOB_ID,
            status: TIMETABLE_STATUS.GENERATING,
          }),
          data: expect.objectContaining({ status: TIMETABLE_STATUS.FAILED }),
        }),
      );
    });

    it('drops silently when the timetable was deleted mid-generation', async () => {
      prisma.timetable.findFirst.mockResolvedValue(null);

      await service.handleSolverCompletion(JOB_ID, feasibleResult());

      expect(prisma.timetable.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('reconcile', () => {
    const staleCreatedAt = new Date(
      Date.now() - GENERATION_STALE_AFTER_MS - 1000,
    );
    const freshCreatedAt = new Date();

    it('fails a stale row whose job has vanished from the queue', async () => {
      queue.getJob.mockResolvedValue(undefined);

      await service.reconcile({
        id: TIMETABLE_ID,
        tenantId: TENANT_ID,
        jobId: JOB_ID,
        createdAt: staleCreatedAt,
      });

      expect(prisma.timetable.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TIMETABLE_STATUS.FAILED,
            failureHints: [
              expect.objectContaining({
                code: INFEASIBLE_HINT_CODE.GENERATION_INTERRUPTED,
              }),
            ],
          }),
        }),
      );
    });

    it('leaves a fresh row alone when its job has vanished but the window has not elapsed', async () => {
      queue.getJob.mockResolvedValue(undefined);

      await service.reconcile({
        id: TIMETABLE_ID,
        tenantId: TENANT_ID,
        jobId: JOB_ID,
        createdAt: freshCreatedAt,
      });

      expect(prisma.timetable.updateMany).not.toHaveBeenCalled();
    });

    it('persists the result when the job has completed', async () => {
      prisma.timetable.findFirst.mockResolvedValue({
        id: TIMETABLE_ID,
        tenantId: TENANT_ID,
        jobId: JOB_ID,
      });
      queue.getJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue('completed'),
        returnvalue: feasibleResult(),
        failedReason: undefined,
      });

      await service.reconcile({
        id: TIMETABLE_ID,
        tenantId: TENANT_ID,
        jobId: JOB_ID,
        createdAt: freshCreatedAt,
      });

      expect(prisma.timetableSlot.createMany).toHaveBeenCalled();
    });

    it('leaves an in-flight (active) job untouched', async () => {
      queue.getJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue('active'),
      });

      await service.reconcile({
        id: TIMETABLE_ID,
        tenantId: TENANT_ID,
        jobId: JOB_ID,
        createdAt: freshCreatedAt,
      });

      expect(prisma.timetable.updateMany).not.toHaveBeenCalled();
    });
  });
});
