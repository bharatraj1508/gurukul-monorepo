// Nest <-> Python solver contract. This file is the source of truth;
// apps/solver/solver/contracts.py mirrors these shapes. Bump
// SOLVER_CONTRACT_SCHEMA_VERSION in timetables.constants.ts on breaking change.
import { InfeasibleHintCode, ViolationCode } from '../timetables.constants';

// ---------------------------------------------------------------------------
// Job payload (Nest -> Python). Fully denormalized snapshot: the worker never
// touches the database. Persisted verbatim to Timetable.inputSnapshot.
// ---------------------------------------------------------------------------

export interface SolverGrid {
  /** ISO weekdays the school runs, 1=Monday..7=Sunday. */
  workingDays: number[];
  /** Teaching period numbers in day order, e.g. [1..8]. Breaks are not included. */
  periodNumbers: number[];
}

export interface SolverClass {
  id: string;
  name: string;
  studentCount: number;
}

export interface SolverTeacher {
  /** TenantMembership id. */
  id: string;
  name: string;
  maxPeriodsPerDay?: number | null;
  maxPeriodsPerWeek?: number | null;
  maxConsecutivePeriods?: number | null;
  /**
   * Allowed period numbers per ISO weekday, e.g. {"1": [1,2,3,8]}.
   * Omitted/null means fully available on all working days.
   */
  availability?: Record<string, number[]> | null;
}

export interface SolverRoom {
  id: string;
  name: string;
  type: string;
  capacity: number;
}

export interface SolverLesson {
  /** CourseAllocation id — echoed back on result slots for traceability. */
  id: string;
  classId: string;
  courseId: string;
  courseName: string;
  /** TenantMembership id of the assigned teacher (resolved from ClassInstructorCourse). */
  teacherId: string;
  periodsPerWeek: number;
  /** Sessions are scheduled in consecutive-period blocks of this size. */
  blockSize: number;
  /** Pinned room. Mutually exclusive with roomType. */
  roomId?: string | null;
  /** Any room of this type (capacity >= class studentCount). */
  roomType?: string | null;
}

export interface SolverWeights {
  spread: number;
  teacherBalance: number;
}

export interface SolverLimits {
  timeLimitSeconds: number;
}

export interface SolverJobPayload {
  schemaVersion: number;
  timetableId: string;
  tenantId: string;
  grid: SolverGrid;
  classes: SolverClass[];
  teachers: SolverTeacher[];
  rooms: SolverRoom[];
  lessons: SolverLesson[];
  weights: SolverWeights;
  limits: SolverLimits;
}

// ---------------------------------------------------------------------------
// Job result (Python -> Nest, via BullMQ returnvalue).
// INFEASIBLE is a *successful* job carrying hints; the worker only throws on
// payload/infrastructure errors.
// ---------------------------------------------------------------------------

export type SolverStatus = 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'ERROR';

export interface SolverResultSlot {
  classId: string;
  dayOfWeek: number;
  periodNumber: number;
  courseId: string;
  teacherId: string;
  roomId: string | null;
  /** CourseAllocation id this slot was placed for. */
  allocationId: string;
}

export interface SolverViolation {
  code: ViolationCode | string;
  message: string;
  params: Record<string, unknown>;
}

export interface SolverInfeasibleHint {
  code: InfeasibleHintCode | string;
  message: string;
  params: Record<string, unknown>;
}

export interface SolverStats {
  solverStatus: string;
  objectiveValue: number | null;
  wallTimeMs: number;
  conflicts: number;
  branches: number;
}

export interface SolverResult {
  schemaVersion: number;
  timetableId: string;
  status: SolverStatus;
  slots: SolverResultSlot[];
  violations: SolverViolation[];
  infeasibleHints: SolverInfeasibleHint[];
  stats: SolverStats;
  /** Present only when status is ERROR. */
  error?: string;
}
