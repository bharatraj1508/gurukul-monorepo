// Shared constants for the timetable feature.
// Queue/job names and all machine-readable codes are mirrored in
// apps/solver/solver/constants.py — keep the two files in sync.

export const TIMETABLE_SOLVER_QUEUE = 'timetable-solver';
export const TIMETABLE_SOLVER_JOB = 'solve-timetable';

export const SOLVER_CONTRACT_SCHEMA_VERSION = 1;

export const TIMETABLE_STATUS = {
  GENERATING: 'GENERATING',
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
  FAILED: 'FAILED',
} as const;
export type TimetableStatus =
  (typeof TIMETABLE_STATUS)[keyof typeof TIMETABLE_STATUS];

export const PERIOD_SLOT_KIND = {
  PERIOD: 'PERIOD',
  BREAK: 'BREAK',
  ASSEMBLY: 'ASSEMBLY',
  LUNCH: 'LUNCH',
} as const;
export type PeriodSlotKind =
  (typeof PERIOD_SLOT_KIND)[keyof typeof PERIOD_SLOT_KIND];

export const ROOM_TYPE = {
  CLASSROOM: 'CLASSROOM',
  SCIENCE_LAB: 'SCIENCE_LAB',
  COMPUTER_LAB: 'COMPUTER_LAB',
  SPORTS: 'SPORTS',
  AUDITORIUM: 'AUDITORIUM',
  OTHER: 'OTHER',
} as const;
export type RoomType = (typeof ROOM_TYPE)[keyof typeof ROOM_TYPE];

// Editor collision codes returned in 409 bodies by slot move/swap.
export const SLOT_CONFLICT_CODE = {
  CLASS_BUSY: 'CLASS_BUSY',
  TEACHER_BUSY: 'TEACHER_BUSY',
  ROOM_BUSY: 'ROOM_BUSY',
  TEACHER_UNAVAILABLE: 'TEACHER_UNAVAILABLE',
  INVALID_PERIOD: 'INVALID_PERIOD',
} as const;
export type SlotConflictCode =
  (typeof SLOT_CONFLICT_CODE)[keyof typeof SLOT_CONFLICT_CODE];

// Soft-constraint violation codes reported by the solver on DRAFT results.
export const VIOLATION_CODE = {
  SUBJECT_NOT_SPREAD: 'SUBJECT_NOT_SPREAD',
  TEACHER_LOAD_IMBALANCE: 'TEACHER_LOAD_IMBALANCE',
} as const;
export type ViolationCode =
  (typeof VIOLATION_CODE)[keyof typeof VIOLATION_CODE];

// Actionable infeasibility hint codes reported when generation FAILED.
export const INFEASIBLE_HINT_CODE = {
  TEACHER_OVERLOADED: 'TEACHER_OVERLOADED',
  CLASS_OVERALLOCATED: 'CLASS_OVERALLOCATED',
  ROOM_TYPE_SCARCE: 'ROOM_TYPE_SCARCE',
  AVAILABILITY_CONFLICT: 'AVAILABILITY_CONFLICT',
  BLOCK_SIZE_IMPOSSIBLE: 'BLOCK_SIZE_IMPOSSIBLE',
  GENERATION_INTERRUPTED: 'GENERATION_INTERRUPTED',
  UNKNOWN: 'UNKNOWN',
} as const;
export type InfeasibleHintCode =
  (typeof INFEASIBLE_HINT_CODE)[keyof typeof INFEASIBLE_HINT_CODE];

// Preflight issue codes (POST /timetables/preflight and generate-time validation).
export const PREFLIGHT_CODE = {
  NO_ALLOCATIONS: 'NO_ALLOCATIONS',
  MISSING_INSTRUCTOR: 'MISSING_INSTRUCTOR',
  AMBIGUOUS_INSTRUCTOR: 'AMBIGUOUS_INSTRUCTOR',
  CLASS_OVERALLOCATED: 'CLASS_OVERALLOCATED',
  TEACHER_OVERLOADED: 'TEACHER_OVERLOADED',
  ROOM_TYPE_MISSING: 'ROOM_TYPE_MISSING',
  BLOCK_SIZE_INVALID: 'BLOCK_SIZE_INVALID',
} as const;
export type PreflightCode =
  (typeof PREFLIGHT_CODE)[keyof typeof PREFLIGHT_CODE];

// A GENERATING timetable whose job vanished from Redis is failed after this window.
export const GENERATION_STALE_AFTER_MS = 15 * 60 * 1000;

// Server-side cap on solver wall time; requests above this are clamped.
export const SOLVER_MAX_TIME_LIMIT_SECONDS = 300;
export const SOLVER_DEFAULT_TIME_LIMIT_SECONDS = 120;
