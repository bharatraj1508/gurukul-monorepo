"""CP-SAT model construction and the solve() orchestrator.

Sessions: each lesson expands into periodsPerWeek/blockSize sessions of
blockSize consecutive periods. A session start variable x[s, d, block] exists
only where the whole block fits inside a run of consecutive period numbers
(blocks never span breaks). Room-type lessons additionally pick exactly one
eligible room via r[s, m]; room occupancy uses z = x AND r.

Relaxable teacher constraints (availability, maxPeriodsPerDay,
maxPeriodsPerWeek, maxConsecutivePeriods) are attached behind one assumption
literal per (family, teacherId) so an INFEASIBLE core can be mapped back to
actionable hints.
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional

from ortools.sat.python import cp_model

from .constants import (
    SOLVER_CONTRACT_SCHEMA_VERSION,
    SOLVER_MAX_TIME_LIMIT_SECONDS,
    STATUS_ERROR,
    STATUS_INFEASIBLE,
)
from .contracts import (
    SolverJobPayload,
    SolverLesson,
    SolverResult,
    SolverStats,
)
from .preflight import consecutive_runs

logger = logging.getLogger("solver.model")

RANDOM_SEED = 42

# Assumption families for relaxable teacher constraints.
FAMILY_AVAILABILITY = "availability"
FAMILY_MAX_PER_DAY = "maxPeriodsPerDay"
FAMILY_MAX_PER_WEEK = "maxPeriodsPerWeek"
FAMILY_MAX_CONSECUTIVE = "maxConsecutivePeriods"

# Objective weights arrive as JSON numbers; scale to integers for CP-SAT.
WEIGHT_SCALE = 100


@dataclass
class SessionCtx:
    """One schedulable block of a lesson."""

    index: int
    lesson: SolverLesson
    # Candidate (day, block) placements; block is a tuple of consecutive
    # period numbers of length lesson.blockSize.
    starts: list[tuple[int, tuple[int, ...], cp_model.IntVar]] = field(default_factory=list)


@dataclass
class BuiltModel:
    model: cp_model.CpModel
    payload: SolverJobPayload
    sessions: list[SessionCtx]
    # session index -> roomId -> choice literal (room-type lessons only).
    room_choice: dict[int, dict[str, cp_model.IntVar]]
    # session index -> pinned roomId (roomId lessons only).
    pinned_room: dict[int, str]
    # Assumption literal index -> (family, teacherId).
    assumption_by_index: dict[int, tuple[str, str]]
    assumption_literals: list[cp_model.IntVar]


def _candidate_blocks(period_numbers: list[int], block_size: int) -> list[tuple[int, ...]]:
    blocks: list[tuple[int, ...]] = []
    for run in consecutive_runs(period_numbers):
        for i in range(len(run) - block_size + 1):
            blocks.append(tuple(run[i : i + block_size]))
    return blocks


def _add_contradiction(model: cp_model.CpModel, name: str) -> None:
    """Force the model infeasible (used when a session has no legal placement)."""
    lit = model.new_bool_var(name)
    model.add(lit == 1)
    model.add(lit == 0)


def build_model(payload: SolverJobPayload) -> BuiltModel:
    model = cp_model.CpModel()
    grid = payload.grid
    days = list(grid.workingDays)
    periods = sorted(grid.periodNumbers)
    runs = consecutive_runs(periods)
    grid_capacity = len(days) * len(periods)

    class_by_id = {c.id: c for c in payload.classes}
    teacher_by_id = {t.id: t for t in payload.teachers}

    sessions: list[SessionCtx] = []
    room_choice: dict[int, dict[str, cp_model.IntVar]] = {}
    pinned_room: dict[int, str] = {}

    # Occupancy accumulators: (entityId, day, period) -> [literal, ...]
    class_occ: dict[tuple[str, int, int], list] = defaultdict(list)
    teacher_occ: dict[tuple[str, int, int], list] = defaultdict(list)
    room_occ: dict[tuple[str, int, int], list] = defaultdict(list)

    blocks_by_size: dict[int, list[tuple[int, ...]]] = {}

    # --- Session start variables -------------------------------------------------
    for lesson_index, lesson in enumerate(payload.lessons):
        if lesson.blockSize not in blocks_by_size:
            blocks_by_size[lesson.blockSize] = _candidate_blocks(periods, lesson.blockSize)
        blocks = blocks_by_size[lesson.blockSize]
        session_count = lesson.periodsPerWeek // lesson.blockSize

        lesson_sessions: list[SessionCtx] = []
        for k in range(session_count):
            s = len(sessions)
            ctx = SessionCtx(index=s, lesson=lesson)
            for d in days:
                for block in blocks:
                    var = model.new_bool_var(f"x_s{s}_d{d}_p{block[0]}")
                    ctx.starts.append((d, block, var))
                    for q in block:
                        class_occ[(lesson.classId, d, q)].append(var)
                        teacher_occ[(lesson.teacherId, d, q)].append(var)
                        if lesson.roomId is not None:
                            room_occ[(lesson.roomId, d, q)].append(var)
            sessions.append(ctx)
            lesson_sessions.append(ctx)

            # Each session is placed exactly once.
            start_vars = [v for _, _, v in ctx.starts]
            if start_vars:
                model.add_exactly_one(start_vars)
            else:
                _add_contradiction(model, f"impossible_block_l{lesson_index}_s{k}")

            if lesson.roomId is not None:
                pinned_room[s] = lesson.roomId

            # Room choice for room-type lessons (type + capacity filter).
            if lesson.roomType is not None:
                clazz = class_by_id[lesson.classId]
                eligible = [
                    r
                    for r in payload.rooms
                    if r.type == lesson.roomType and r.capacity >= clazz.studentCount
                ]
                if not eligible:
                    _add_contradiction(model, f"no_room_l{lesson_index}_s{k}")
                    room_choice[s] = {}
                else:
                    choices: dict[str, cp_model.IntVar] = {}
                    for room in eligible:
                        r_var = model.new_bool_var(f"r_s{s}_m{room.id}")
                        choices[room.id] = r_var
                        # Occupancy z = x AND r, linearized.
                        for d, block, x_var in ctx.starts:
                            z = model.new_bool_var(f"z_s{s}_m{room.id}_d{d}_p{block[0]}")
                            model.add(z <= x_var)
                            model.add(z <= r_var)
                            model.add(z >= x_var + r_var - 1)
                            for q in block:
                                room_occ[(room.id, d, q)].append(z)
                    model.add_exactly_one(list(choices.values()))
                    room_choice[s] = choices

        # Symmetry breaking: sessions of the same lesson are interchangeable;
        # order them by their placement index to prune permutations.
        if len(lesson_sessions) > 1:
            position_code = {
                (d, block): code
                for code, (d, block) in enumerate(
                    (d, block) for d in days for block in blocks_by_size[lesson.blockSize]
                )
            }
            prev_pos = None
            for ctx in lesson_sessions:
                if not ctx.starts:
                    prev_pos = None
                    break
                pos = sum(position_code[(d, block)] * v for d, block, v in ctx.starts)
                if prev_pos is not None:
                    model.add(prev_pos <= pos - 1)
                prev_pos = pos

    # --- Hard at-most-one occupancy ----------------------------------------------
    for occ in (class_occ, teacher_occ, room_occ):
        for literals in occ.values():
            if len(literals) > 1:
                model.add_at_most_one(literals)

    # --- Relaxable teacher constraints behind assumption literals -----------------
    assumption_by_index: dict[int, tuple[str, str]] = {}
    assumption_literals: list[cp_model.IntVar] = []

    def new_assumption(family: str, teacher_id: str) -> cp_model.IntVar:
        lit = model.new_bool_var(f"assume_{family}_{teacher_id}")
        assumption_by_index[lit.index] = (family, teacher_id)
        assumption_literals.append(lit)
        return lit

    sessions_by_teacher: dict[str, list[SessionCtx]] = defaultdict(list)
    for ctx in sessions:
        sessions_by_teacher[ctx.lesson.teacherId].append(ctx)

    for teacher_id, teacher_sessions in sessions_by_teacher.items():
        teacher = teacher_by_id[teacher_id]

        # Availability: zero out starts whose block touches a disallowed period.
        if teacher.availability is not None:
            lit: Optional[cp_model.IntVar] = None
            for ctx in teacher_sessions:
                for d, block, var in ctx.starts:
                    allowed = teacher.availability.get(str(d))
                    if allowed is None:
                        continue  # Missing day key = fully available that day.
                    allowed_set = set(allowed)
                    if any(q not in allowed_set for q in block):
                        if lit is None:
                            lit = new_assumption(FAMILY_AVAILABILITY, teacher_id)
                        model.add(var == 0).only_enforce_if(lit)

        # Max periods per day.
        if teacher.maxPeriodsPerDay is not None:
            lit = new_assumption(FAMILY_MAX_PER_DAY, teacher_id)
            for d in days:
                day_terms = [
                    len(block) * var
                    for ctx in teacher_sessions
                    for dd, block, var in ctx.starts
                    if dd == d
                ]
                if day_terms:
                    model.add(sum(day_terms) <= teacher.maxPeriodsPerDay).only_enforce_if(lit)

        # Max periods per week. Weekly load is fixed by the lesson demand, so
        # this reduces to demand <= cap — but expressing it on the variables
        # keeps the core attribution uniform.
        if teacher.maxPeriodsPerWeek is not None:
            lit = new_assumption(FAMILY_MAX_PER_WEEK, teacher_id)
            week_terms = [
                len(block) * var for ctx in teacher_sessions for _, block, var in ctx.starts
            ]
            if week_terms:
                model.add(sum(week_terms) <= teacher.maxPeriodsPerWeek).only_enforce_if(lit)

        # Max consecutive periods: sliding windows of size cap+1 within each
        # run of consecutive period numbers must contain a free period.
        if teacher.maxConsecutivePeriods is not None:
            cap = teacher.maxConsecutivePeriods
            lit = new_assumption(FAMILY_MAX_CONSECUTIVE, teacher_id)
            for d in days:
                for run in runs:
                    for i in range(len(run) - cap):
                        window = run[i : i + cap + 1]
                        window_vars = [
                            var
                            for q in window
                            for var in teacher_occ.get((teacher_id, d, q), [])
                        ]
                        if window_vars:
                            model.add(sum(window_vars) <= cap).only_enforce_if(lit)

    if assumption_literals:
        model.add_assumptions(assumption_literals)

    # --- Soft objective ------------------------------------------------------------
    w_spread = int(round(payload.weights.spread * WEIGHT_SCALE))
    w_balance = int(round(payload.weights.teacherBalance * WEIGHT_SCALE))

    # Spread: penalize more than one session of a (class, course) on one day.
    spread_terms = []
    sessions_by_lesson: dict[str, list[SessionCtx]] = defaultdict(list)
    for ctx in sessions:
        sessions_by_lesson[ctx.lesson.id].append(ctx)
    for lesson_id, lesson_sessions in sessions_by_lesson.items():
        if len(lesson_sessions) < 2:
            continue
        for d in days:
            day_vars = [var for ctx in lesson_sessions for dd, _, var in ctx.starts if dd == d]
            if not day_vars:
                continue
            excess = model.new_int_var(0, len(lesson_sessions) - 1, f"excess_{lesson_id}_d{d}")
            model.add(excess >= sum(day_vars) - 1)
            spread_terms.append(excess)

    # Teacher balance: two-sided linear bounds on |load - mean|, scaled by the
    # teacher count so all arithmetic stays integral:
    #   dev_t >= |n * load_t - totalLoad|  (== n * |load_t - mean|)
    balance_terms = []
    loaded_teachers = list(sessions_by_teacher.keys())
    n_teachers = len(loaded_teachers)
    total_load = sum(lesson.periodsPerWeek for lesson in payload.lessons)
    for teacher_id in loaded_teachers:
        load = sum(
            len(block) * var
            for ctx in sessions_by_teacher[teacher_id]
            for _, block, var in ctx.starts
        )
        dev = model.new_int_var(0, n_teachers * grid_capacity, f"dev_{teacher_id}")
        model.add(dev >= n_teachers * load - total_load)
        model.add(dev >= total_load - n_teachers * load)
        balance_terms.append(dev)

    # Both terms are scaled by n_teachers so the relative weighting matches
    # weights.spread * excess + weights.teacherBalance * |load - mean| exactly.
    objective = w_spread * max(n_teachers, 1) * sum(spread_terms) + w_balance * sum(
        balance_terms
    )
    model.minimize(objective)

    return BuiltModel(
        model=model,
        payload=payload,
        sessions=sessions,
        room_choice=room_choice,
        pinned_room=pinned_room,
        assumption_by_index=assumption_by_index,
        assumption_literals=assumption_literals,
    )


def solve(payload: SolverJobPayload, time_limit_seconds: Optional[float] = None) -> SolverResult:
    """Build and solve the model; never raises — internal errors become an
    ERROR-status result so the job pipeline stays single-path."""
    from .hints import collect_infeasible_hints  # local import: avoids cycle
    from .result import build_stats, extract_result

    started = time.monotonic()
    limit = time_limit_seconds if time_limit_seconds is not None else payload.limits.timeLimitSeconds
    limit = max(1.0, min(float(limit), float(SOLVER_MAX_TIME_LIMIT_SECONDS)))

    try:
        built = build_model(payload)
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = limit
        solver.parameters.random_seed = RANDOM_SEED
        cp_status = solver.solve(built.model)
        status_name = solver.status_name(cp_status)
        logger.info(
            "solve finished timetableId=%s status=%s wallTime=%.2fs",
            payload.timetableId,
            status_name,
            solver.wall_time,
        )

        if cp_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return extract_result(built, solver, cp_status)

        if cp_status == cp_model.INFEASIBLE:
            return SolverResult(
                schemaVersion=SOLVER_CONTRACT_SCHEMA_VERSION,
                timetableId=payload.timetableId,
                status=STATUS_INFEASIBLE,
                slots=[],
                violations=[],
                infeasibleHints=collect_infeasible_hints(built, solver),
                stats=build_stats(solver, cp_status),
            )

        # UNKNOWN (time limit without a solution) or MODEL_INVALID.
        return SolverResult(
            schemaVersion=SOLVER_CONTRACT_SCHEMA_VERSION,
            timetableId=payload.timetableId,
            status=STATUS_ERROR,
            slots=[],
            violations=[],
            infeasibleHints=[],
            stats=build_stats(solver, cp_status),
            error=f"Solver ended with status {status_name} without a usable solution",
        )
    except Exception as exc:  # noqa: BLE001 — ERROR result is the contract
        logger.exception("solve crashed timetableId=%s", payload.timetableId)
        wall_ms = int((time.monotonic() - started) * 1000)
        return SolverResult(
            schemaVersion=SOLVER_CONTRACT_SCHEMA_VERSION,
            timetableId=payload.timetableId,
            status=STATUS_ERROR,
            slots=[],
            violations=[],
            infeasibleHints=[],
            stats=SolverStats(
                solverStatus="ERROR",
                objectiveValue=None,
                wallTimeMs=wall_ms,
                conflicts=0,
                branches=0,
            ),
            error=f"{type(exc).__name__}: {exc}",
        )
