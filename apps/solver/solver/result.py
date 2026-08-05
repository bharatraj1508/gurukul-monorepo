"""Extract slots, soft-constraint violations and stats from a solved model."""

from __future__ import annotations

from collections import defaultdict
from typing import TYPE_CHECKING, Optional

from ortools.sat.python import cp_model

from .constants import (
    ISO_DAY_NAMES,
    SOLVER_CONTRACT_SCHEMA_VERSION,
    STATUS_FEASIBLE,
    STATUS_OPTIMAL,
    VIOLATION_SUBJECT_NOT_SPREAD,
    VIOLATION_TEACHER_LOAD_IMBALANCE,
)
from .contracts import (
    SolverResult,
    SolverResultSlot,
    SolverStats,
    SolverViolation,
)

if TYPE_CHECKING:
    from .model import BuiltModel

# Teachers whose weekly load deviates from the mean by more than this many
# periods are reported (soft signal only; never blocks a draft).
LOAD_IMBALANCE_TOLERANCE = 2.0


def build_stats(solver: cp_model.CpSolver, cp_status: int) -> SolverStats:
    has_solution = cp_status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    return SolverStats(
        solverStatus=solver.status_name(cp_status),
        objectiveValue=float(solver.objective_value) if has_solution else None,
        wallTimeMs=int(solver.wall_time * 1000),
        conflicts=solver.num_conflicts,
        branches=solver.num_branches,
    )


def _chosen_room(built: "BuiltModel", solver: cp_model.CpSolver, session_index: int) -> Optional[str]:
    pinned = built.pinned_room.get(session_index)
    if pinned is not None:
        return pinned
    choices = built.room_choice.get(session_index)
    if not choices:
        return None
    for room_id, var in choices.items():
        if solver.boolean_value(var):
            return room_id
    return None


def extract_result(
    built: "BuiltModel", solver: cp_model.CpSolver, cp_status: int
) -> SolverResult:
    payload = built.payload
    class_names = {c.id: c.name for c in payload.classes}
    teacher_names = {t.id: t.name for t in payload.teachers}

    slots: list[SolverResultSlot] = []
    # (allocationId, day) -> number of sessions (blocks) placed that day.
    sessions_per_day: dict[tuple[str, int], int] = defaultdict(int)
    lesson_by_id = {lesson.id: lesson for lesson in payload.lessons}

    for ctx in built.sessions:
        placement = next(
            ((d, block) for d, block, var in ctx.starts if solver.boolean_value(var)),
            None,
        )
        if placement is None:  # Cannot happen for a feasible solution.
            continue
        day, block = placement
        sessions_per_day[(ctx.lesson.id, day)] += 1
        room_id = _chosen_room(built, solver, ctx.index)
        for period in block:
            slots.append(
                SolverResultSlot(
                    classId=ctx.lesson.classId,
                    dayOfWeek=day,
                    periodNumber=period,
                    courseId=ctx.lesson.courseId,
                    teacherId=ctx.lesson.teacherId,
                    roomId=room_id,
                    allocationId=ctx.lesson.id,
                )
            )

    slots.sort(key=lambda s: (s.classId, s.dayOfWeek, s.periodNumber))

    violations: list[SolverViolation] = []

    # SUBJECT_NOT_SPREAD: more than one session of a (class, course) on a day.
    for (allocation_id, day), count in sorted(sessions_per_day.items()):
        if count <= 1:
            continue
        lesson = lesson_by_id[allocation_id]
        class_name = class_names.get(lesson.classId, lesson.classId)
        day_name = ISO_DAY_NAMES.get(day, str(day))
        violations.append(
            SolverViolation(
                code=VIOLATION_SUBJECT_NOT_SPREAD,
                message=(
                    f"{lesson.courseName} for {class_name} has {count} sessions "
                    f"on {day_name}; spreading them across days is preferred."
                ),
                params={
                    "allocationId": allocation_id,
                    "classId": lesson.classId,
                    "className": class_name,
                    "courseId": lesson.courseId,
                    "courseName": lesson.courseName,
                    "dayOfWeek": day,
                    "count": count,
                },
            )
        )

    # TEACHER_LOAD_IMBALANCE: weekly load far from the mean across teachers.
    loads: dict[str, int] = defaultdict(int)
    for slot in slots:
        loads[slot.teacherId] += 1
    if loads:
        mean_load = sum(loads.values()) / len(loads)
        for teacher_id, load in sorted(loads.items()):
            deviation = abs(load - mean_load)
            if deviation <= LOAD_IMBALANCE_TOLERANCE:
                continue
            teacher_name = teacher_names.get(teacher_id, teacher_id)
            violations.append(
                SolverViolation(
                    code=VIOLATION_TEACHER_LOAD_IMBALANCE,
                    message=(
                        f"{teacher_name} teaches {load} periods per week versus a "
                        f"mean of {mean_load:.1f} across teachers."
                    ),
                    params={
                        "teacherId": teacher_id,
                        "teacherName": teacher_name,
                        "load": load,
                        "meanLoad": round(mean_load, 2),
                        "deviation": round(deviation, 2),
                    },
                )
            )

    return SolverResult(
        schemaVersion=SOLVER_CONTRACT_SCHEMA_VERSION,
        timetableId=payload.timetableId,
        status=STATUS_OPTIMAL if cp_status == cp_model.OPTIMAL else STATUS_FEASIBLE,
        slots=slots,
        violations=violations,
        infeasibleHints=[],
        stats=build_stats(solver, cp_status),
    )
