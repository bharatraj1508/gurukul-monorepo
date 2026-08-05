import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { CourseAllocationsController } from './config/course-allocations.controller';
import { CourseAllocationsService } from './config/course-allocations.service';
import { PeriodTemplatesController } from './config/period-templates.controller';
import { PeriodTemplatesService } from './config/period-templates.service';
import { TeacherConstraintsController } from './config/teacher-constraints.controller';
import { TeacherConstraintsService } from './config/teacher-constraints.service';
import { TimetableSnapshotService } from './solver/timetable-snapshot.service';
import { TimetableSolverEvents } from './solver/timetable-solver.events';
import { TimetableSolverService } from './solver/timetable-solver.service';
import { SubstitutionsController } from './substitutions/substitutions.controller';
import { SubstitutionsService } from './substitutions/substitutions.service';
import { TimetableEditorService } from './timetable-editor.service';
import { TimetableViewerController } from './timetable-viewer.controller';
import { TimetableViewerService } from './timetable-viewer.service';
import { TIMETABLE_SOLVER_QUEUE } from './timetables.constants';
import { TimetablesController } from './timetables.controller';
import { TimetablesService } from './timetables.service';

/**
 * Timetable feature: configuration (period templates, allocations, teacher
 * constraints), CP-SAT generation via the external Python worker, draft
 * editing, publishing, substitutions, and the viewer endpoints.
 *
 * The solver queue deliberately has NO @Processor here — the Python worker
 * (apps/solver) is its only consumer; Nest enqueues and listens to events.
 */
@Module({
  imports: [
    BullModule.registerQueue({
      name: TIMETABLE_SOLVER_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    }),
  ],
  controllers: [
    TimetablesController,
    TimetableViewerController,
    SubstitutionsController,
    PeriodTemplatesController,
    CourseAllocationsController,
    TeacherConstraintsController,
  ],
  providers: [
    TimetablesService,
    TimetableEditorService,
    TimetableViewerService,
    SubstitutionsService,
    PeriodTemplatesService,
    CourseAllocationsService,
    TeacherConstraintsService,
    TimetableSnapshotService,
    TimetableSolverService,
    TimetableSolverEvents,
  ],
  exports: [TimetablesService],
})
export class TimetablesModule {}
