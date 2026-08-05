"""Shared fixture school for the solver test suite.

School: 5 working days x 6 periods (numbers 1..6), classes 6A and 6B with 25
students, 5 subject teachers. Per class: MATH 5/wk, ENG 5/wk, SCI 4/wk in
blocks of 2 requiring a SCIENCE_LAB, HIN 4/wk, ART 2/wk (ART teacher shared
across both classes). The Hindi teacher has availability holes and a
maxConsecutivePeriods of 2.

Weekly teacher loads: MATH 10, ENG 10, SCI 8, HIN 8, ART 4 (mean 8).
Class demand: 20 periods per class on a 30-slot grid.
"""

from __future__ import annotations

import pytest

from solver.contracts import parse_payload
from solver.model import solve

LAB_ID = "room-lab"
HIN_AVAILABILITY = {"1": [1, 2, 3, 4], "3": [2, 3, 4, 5, 6]}


def build_school_payload() -> dict:
    def lesson(class_id: str, course: str, teacher: str, per_week: int, block: int = 1, **extra):
        return {
            "id": f"alloc-{class_id}-{course}".lower(),
            "classId": class_id,
            "courseId": f"course-{course}".lower(),
            "courseName": course.capitalize(),
            "teacherId": teacher,
            "periodsPerWeek": per_week,
            "blockSize": block,
            "roomId": None,
            "roomType": None,
            **extra,
        }

    lessons = []
    for class_id in ("6A", "6B"):
        lessons.extend(
            [
                lesson(class_id, "MATH", "t-math", 5),
                lesson(class_id, "ENG", "t-eng", 5),
                lesson(class_id, "SCI", "t-sci", 4, block=2, roomType="SCIENCE_LAB"),
                lesson(class_id, "HIN", "t-hin", 4),
                lesson(class_id, "ART", "t-art", 2),
            ]
        )

    return {
        "schemaVersion": 1,
        "timetableId": "tt-1",
        "tenantId": "tenant-1",
        "grid": {"workingDays": [1, 2, 3, 4, 5], "periodNumbers": [1, 2, 3, 4, 5, 6]},
        "classes": [
            {"id": "6A", "name": "Class 6A", "studentCount": 25},
            {"id": "6B", "name": "Class 6B", "studentCount": 25},
        ],
        "teachers": [
            {"id": "t-math", "name": "Math Teacher"},
            {"id": "t-eng", "name": "English Teacher"},
            {"id": "t-sci", "name": "Science Teacher"},
            {
                "id": "t-hin",
                "name": "Hindi Teacher",
                "maxConsecutivePeriods": 2,
                "availability": {k: list(v) for k, v in HIN_AVAILABILITY.items()},
            },
            {"id": "t-art", "name": "Art Teacher"},
        ],
        "rooms": [
            {"id": LAB_ID, "name": "Physics Lab", "type": "SCIENCE_LAB", "capacity": 30},
            {"id": "room-101", "name": "Room 101", "type": "CLASSROOM", "capacity": 40},
        ],
        "lessons": lessons,
        "weights": {"spread": 10, "teacherBalance": 1},
        "limits": {"timeLimitSeconds": 20},
    }


def solve_raw(raw_payload: dict):
    """Parse a raw dict payload and solve it."""
    return solve(parse_payload(raw_payload))


@pytest.fixture
def school_payload() -> dict:
    return build_school_payload()


@pytest.fixture(scope="session")
def solved_school():
    """The base school solved once for all read-only assertions."""
    payload = parse_payload(build_school_payload())
    return payload, solve(payload)
