"""Arithmetic pigeonhole checks mirroring the Nest preflight.

These run without CP-SAT and produce actionable hint dicts that are unioned
with the assumption-core hints when the model comes back INFEASIBLE.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from .constants import (
    HINT_BLOCK_SIZE_IMPOSSIBLE,
    HINT_CLASS_OVERALLOCATED,
    HINT_ROOM_TYPE_SCARCE,
    HINT_TEACHER_OVERLOADED,
    ISO_DAY_NAMES,
)
from .contracts import SolverJobPayload, SolverTeacher


def consecutive_runs(period_numbers: list[int]) -> list[list[int]]:
    """Split sorted period numbers into maximal runs of consecutive integers.

    Blocks must never span a gap in the period-number list (a gap means a
    break/lunch sits between the two teaching periods).
    """
    runs: list[list[int]] = []
    for p in sorted(period_numbers):
        if runs and p == runs[-1][-1] + 1:
            runs[-1].append(p)
        else:
            runs.append([p])
    return runs


def _hint(code: str, message: str, params: dict[str, Any]) -> dict[str, Any]:
    return {"code": code, "message": message, "params": params}


def _available_periods(
    teacher: SolverTeacher, day: int, period_numbers: list[int]
) -> list[int]:
    """Teaching periods the teacher may take on `day` per their availability."""
    if teacher.availability is None:
        return list(period_numbers)
    allowed = teacher.availability.get(str(day))
    if allowed is None:
        # Missing day key = fully available on that day.
        return list(period_numbers)
    allowed_set = set(allowed)
    return [p for p in period_numbers if p in allowed_set]


def _check_class_overallocated(payload: SolverJobPayload) -> list[dict[str, Any]]:
    grid_capacity = len(payload.grid.workingDays) * len(payload.grid.periodNumbers)
    class_names = {c.id: c.name for c in payload.classes}
    demand: dict[str, int] = defaultdict(int)
    for lesson in payload.lessons:
        demand[lesson.classId] += lesson.periodsPerWeek

    hints = []
    for class_id, allocated in sorted(demand.items()):
        if allocated > grid_capacity:
            name = class_names.get(class_id, class_id)
            hints.append(
                _hint(
                    HINT_CLASS_OVERALLOCATED,
                    f"Class {name} is allocated {allocated} periods per week but the "
                    f"grid only has {grid_capacity} teaching slots. Reduce its course "
                    f"allocations or add periods/working days.",
                    {
                        "classId": class_id,
                        "className": name,
                        "allocatedPeriods": allocated,
                        "gridCapacity": grid_capacity,
                    },
                )
            )
    return hints


def _teacher_weekly_capacity(teacher: SolverTeacher, payload: SolverJobPayload) -> int:
    """Upper bound on periods/week the teacher can physically teach."""
    per_day_total = 0
    for day in payload.grid.workingDays:
        per_day = len(_available_periods(teacher, day, payload.grid.periodNumbers))
        if teacher.maxPeriodsPerDay is not None:
            per_day = min(per_day, teacher.maxPeriodsPerDay)
        per_day_total += per_day
    capacity = per_day_total
    if teacher.maxPeriodsPerWeek is not None:
        capacity = min(capacity, teacher.maxPeriodsPerWeek)
    return capacity


def _check_teacher_overloaded(payload: SolverJobPayload) -> list[dict[str, Any]]:
    demand: dict[str, int] = defaultdict(int)
    for lesson in payload.lessons:
        demand[lesson.teacherId] += lesson.periodsPerWeek

    hints = []
    for teacher in payload.teachers:
        weekly_demand = demand.get(teacher.id, 0)
        if weekly_demand == 0:
            continue
        capacity = _teacher_weekly_capacity(teacher, payload)
        if weekly_demand > capacity:
            hints.append(
                _hint(
                    HINT_TEACHER_OVERLOADED,
                    f"Teacher {teacher.name} is assigned {weekly_demand} periods per week "
                    f"but can teach at most {capacity} given their limits and availability. "
                    f"Raise their limits or reassign some courses.",
                    {
                        "teacherId": teacher.id,
                        "teacherName": teacher.name,
                        "demandPeriods": weekly_demand,
                        "weeklyCapacity": capacity,
                    },
                )
            )
    return hints


def _check_room_type_scarce(payload: SolverJobPayload) -> list[dict[str, Any]]:
    grid_capacity = len(payload.grid.workingDays) * len(payload.grid.periodNumbers)
    class_by_id = {c.id: c for c in payload.classes}
    hints = []

    # Per lesson: no room of the requested type is big enough.
    demand_by_type: dict[str, int] = defaultdict(int)
    for lesson in payload.lessons:
        if lesson.roomType is None:
            continue
        demand_by_type[lesson.roomType] += lesson.periodsPerWeek
        clazz = class_by_id[lesson.classId]
        eligible = [
            r
            for r in payload.rooms
            if r.type == lesson.roomType and r.capacity >= clazz.studentCount
        ]
        if not eligible:
            hints.append(
                _hint(
                    HINT_ROOM_TYPE_SCARCE,
                    f"{lesson.courseName} for {clazz.name} needs a {lesson.roomType} room "
                    f"with capacity >= {clazz.studentCount}, but none exists. Add such a "
                    f"room or change the allocation.",
                    {
                        "roomType": lesson.roomType,
                        "classId": clazz.id,
                        "className": clazz.name,
                        "courseId": lesson.courseId,
                        "courseName": lesson.courseName,
                        "requiredCapacity": clazz.studentCount,
                        "eligibleRooms": 0,
                    },
                )
            )

    # Per type: weekly demand exceeds what the room stock can host.
    for room_type, demand in sorted(demand_by_type.items()):
        room_count = sum(1 for r in payload.rooms if r.type == room_type)
        supply = room_count * grid_capacity
        if demand > supply:
            hints.append(
                _hint(
                    HINT_ROOM_TYPE_SCARCE,
                    f"Lessons need {demand} periods per week in {room_type} rooms but the "
                    f"{room_count} room(s) of that type only offer {supply} slots. Add rooms "
                    f"of this type or reduce demand.",
                    {
                        "roomType": room_type,
                        "demandPeriods": demand,
                        "roomCount": room_count,
                        "supplyPeriods": supply,
                    },
                )
            )
    return hints


def _check_block_size_impossible(payload: SolverJobPayload) -> list[dict[str, Any]]:
    runs = consecutive_runs(payload.grid.periodNumbers)
    longest_run = max((len(r) for r in runs), default=0)
    class_names = {c.id: c.name for c in payload.classes}

    hints = []
    for lesson in payload.lessons:
        if lesson.blockSize > longest_run:
            class_name = class_names.get(lesson.classId, lesson.classId)
            hints.append(
                _hint(
                    HINT_BLOCK_SIZE_IMPOSSIBLE,
                    f"{lesson.courseName} for {class_name} needs blocks of "
                    f"{lesson.blockSize} consecutive periods, but the longest stretch of "
                    f"consecutive periods in the day is {longest_run}. Reduce the block "
                    f"size or restructure the period template.",
                    {
                        "allocationId": lesson.id,
                        "classId": lesson.classId,
                        "className": class_name,
                        "courseId": lesson.courseId,
                        "courseName": lesson.courseName,
                        "blockSize": lesson.blockSize,
                        "longestConsecutiveRun": longest_run,
                    },
                )
            )
    return hints


def run_preflight(payload: SolverJobPayload) -> list[dict[str, Any]]:
    """Run all pigeonhole checks; returns hint dicts (possibly empty)."""
    hints: list[dict[str, Any]] = []
    hints.extend(_check_class_overallocated(payload))
    hints.extend(_check_teacher_overloaded(payload))
    hints.extend(_check_room_type_scarce(payload))
    hints.extend(_check_block_size_impossible(payload))
    return hints


__all__ = ["run_preflight", "consecutive_runs", "ISO_DAY_NAMES"]
