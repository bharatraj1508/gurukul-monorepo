import {
  InjectQueue,
  OnQueueEvent,
  QueueEventsHost,
  QueueEventsListener,
} from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { Queue } from 'bullmq';

import { TIMETABLE_SOLVER_QUEUE } from '../timetables.constants';
import { SolverJobPayload, SolverResult } from './timetable-solver.contracts';
import { TimetableSolverService } from './timetable-solver.service';

/**
 * Receives results of jobs processed by the external Python worker. The event
 * payload's `returnvalue` is a string, so the job is re-fetched via
 * Queue.getJob(jobId) and its parsed `returnvalue` (the bullmq Python worker
 * returns the object form) is handed to the persistence pipeline.
 */
@Injectable()
@QueueEventsListener(TIMETABLE_SOLVER_QUEUE)
export class TimetableSolverEvents extends QueueEventsHost {
  private readonly logger = new Logger(TimetableSolverEvents.name);

  constructor(
    @InjectQueue(TIMETABLE_SOLVER_QUEUE)
    private readonly queue: Queue<SolverJobPayload, SolverResult>,
    private readonly solverService: TimetableSolverService,
  ) {
    super();
  }

  @OnQueueEvent('completed')
  async onCompleted(event: { jobId: string }) {
    try {
      const job = await this.queue.getJob(event.jobId);
      await this.solverService.handleSolverCompletion(
        event.jobId,
        (job?.returnvalue ?? null) as SolverResult | null,
      );
    } catch (err) {
      this.logger.error(
        `Failed handling completion of solver job ${event.jobId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  @OnQueueEvent('failed')
  async onFailed(event: { jobId: string; failedReason?: string }) {
    try {
      const job = await this.queue.getJob(event.jobId);
      if (job) {
        // With attempts: 2 a first failure may still be retried — only a job
        // actually sitting in the failed set is final.
        const state = await job.getState();
        if (state !== 'failed') return;
      }
      await this.solverService.handleSolverFailure(
        event.jobId,
        event.failedReason,
      );
    } catch (err) {
      this.logger.error(
        `Failed handling failure of solver job ${event.jobId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
