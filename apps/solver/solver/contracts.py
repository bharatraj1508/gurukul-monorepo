"""Python mirror of the Nest <-> solver contract.

Source of truth: apps/api/src/timetables/solver/timetable-solver.contracts.ts
Field names are intentionally camelCase so that (de)serialization is a
straight passthrough of the JSON payload/result — do not "pythonize" them.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from .constants import SOLVER_CONTRACT_SCHEMA_VERSION


class PayloadValidationError(ValueError):
    """Raised when a job payload does not match the solver contract."""


# ---------------------------------------------------------------------------
# Payload (Nest -> Python)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SolverGrid:
    workingDays: list[int]
    periodNumbers: list[int]


@dataclass(frozen=True)
class SolverClass:
    id: str
    name: str
    studentCount: int


@dataclass(frozen=True)
class SolverTeacher:
    id: str
    name: str
    maxPeriodsPerDay: Optional[int] = None
    maxPeriodsPerWeek: Optional[int] = None
    maxConsecutivePeriods: Optional[int] = None
    # Allowed period numbers per ISO weekday, e.g. {"1": [1, 2, 3, 8]}.
    # None means fully available. A missing day key means fully available on
    # that day; a present key restricts the day to exactly those periods.
    availability: Optional[dict[str, list[int]]] = None


@dataclass(frozen=True)
class SolverRoom:
    id: str
    name: str
    type: str
    capacity: int


@dataclass(frozen=True)
class SolverLesson:
    id: str  # CourseAllocation id, echoed back on result slots.
    classId: str
    courseId: str
    courseName: str
    teacherId: str
    periodsPerWeek: int
    blockSize: int
    roomId: Optional[str] = None
    roomType: Optional[str] = None


@dataclass(frozen=True)
class SolverWeights:
    spread: float
    teacherBalance: float


@dataclass(frozen=True)
class SolverLimits:
    timeLimitSeconds: float


@dataclass(frozen=True)
class SolverJobPayload:
    schemaVersion: int
    timetableId: str
    tenantId: str
    grid: SolverGrid
    classes: list[SolverClass]
    teachers: list[SolverTeacher]
    rooms: list[SolverRoom]
    lessons: list[SolverLesson]
    weights: SolverWeights
    limits: SolverLimits


# ---------------------------------------------------------------------------
# Result (Python -> Nest, via BullMQ returnvalue)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SolverResultSlot:
    classId: str
    dayOfWeek: int
    periodNumber: int
    courseId: str
    teacherId: str
    roomId: Optional[str]
    allocationId: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "classId": self.classId,
            "dayOfWeek": self.dayOfWeek,
            "periodNumber": self.periodNumber,
            "courseId": self.courseId,
            "teacherId": self.teacherId,
            "roomId": self.roomId,
            "allocationId": self.allocationId,
        }


@dataclass(frozen=True)
class SolverViolation:
    code: str
    message: str
    params: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {"code": self.code, "message": self.message, "params": self.params}


@dataclass(frozen=True)
class SolverInfeasibleHint:
    code: str
    message: str
    params: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {"code": self.code, "message": self.message, "params": self.params}


@dataclass(frozen=True)
class SolverStats:
    solverStatus: str
    objectiveValue: Optional[float]
    wallTimeMs: int
    conflicts: int
    branches: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "solverStatus": self.solverStatus,
            "objectiveValue": self.objectiveValue,
            "wallTimeMs": self.wallTimeMs,
            "conflicts": self.conflicts,
            "branches": self.branches,
        }


@dataclass(frozen=True)
class SolverResult:
    schemaVersion: int
    timetableId: str
    status: str  # OPTIMAL | FEASIBLE | INFEASIBLE | ERROR
    slots: list[SolverResultSlot]
    violations: list[SolverViolation]
    infeasibleHints: list[SolverInfeasibleHint]
    stats: SolverStats
    error: Optional[str] = None  # Present only when status is ERROR.

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "schemaVersion": self.schemaVersion,
            "timetableId": self.timetableId,
            "status": self.status,
            "slots": [s.to_dict() for s in self.slots],
            "violations": [v.to_dict() for v in self.violations],
            "infeasibleHints": [h.to_dict() for h in self.infeasibleHints],
            "stats": self.stats.to_dict(),
        }
        if self.status == "ERROR":
            out["error"] = self.error or "Unknown solver error"
        return out


# ---------------------------------------------------------------------------
# Parsing / validation
# ---------------------------------------------------------------------------


def _require(data: dict, key: str, ctx: str) -> Any:
    if key not in data or data[key] is None:
        raise PayloadValidationError(f"{ctx}: missing required field '{key}'")
    return data[key]


def _require_str(data: dict, key: str, ctx: str) -> str:
    value = _require(data, key, ctx)
    if not isinstance(value, str) or not value.strip():
        raise PayloadValidationError(f"{ctx}: '{key}' must be a non-empty string, got {value!r}")
    return value


def _require_int(data: dict, key: str, ctx: str, minimum: Optional[int] = None) -> int:
    value = _require(data, key, ctx)
    if isinstance(value, bool) or not isinstance(value, int):
        raise PayloadValidationError(f"{ctx}: '{key}' must be an integer, got {value!r}")
    if minimum is not None and value < minimum:
        raise PayloadValidationError(f"{ctx}: '{key}' must be >= {minimum}, got {value}")
    return value


def _require_number(data: dict, key: str, ctx: str, minimum: Optional[float] = None) -> float:
    value = _require(data, key, ctx)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise PayloadValidationError(f"{ctx}: '{key}' must be a number, got {value!r}")
    if minimum is not None and value < minimum:
        raise PayloadValidationError(f"{ctx}: '{key}' must be >= {minimum}, got {value}")
    return float(value)


def _optional_int(data: dict, key: str, ctx: str, minimum: int = 0) -> Optional[int]:
    value = data.get(key)
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int):
        raise PayloadValidationError(f"{ctx}: '{key}' must be an integer or null, got {value!r}")
    if value < minimum:
        raise PayloadValidationError(f"{ctx}: '{key}' must be >= {minimum}, got {value}")
    return value


def _optional_str(data: dict, key: str, ctx: str) -> Optional[str]:
    value = data.get(key)
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip():
        raise PayloadValidationError(f"{ctx}: '{key}' must be a non-empty string or null, got {value!r}")
    return value


def _require_dict(value: Any, ctx: str) -> dict:
    if not isinstance(value, dict):
        raise PayloadValidationError(f"{ctx}: expected an object, got {type(value).__name__}")
    return value


def _require_list(data: dict, key: str, ctx: str, allow_empty: bool = False) -> list:
    value = _require(data, key, ctx)
    if not isinstance(value, list):
        raise PayloadValidationError(f"{ctx}: '{key}' must be an array, got {type(value).__name__}")
    if not value and not allow_empty:
        raise PayloadValidationError(f"{ctx}: '{key}' must not be empty")
    return value


def _int_list(values: list, ctx: str) -> list[int]:
    out: list[int] = []
    for v in values:
        if isinstance(v, bool) or not isinstance(v, int):
            raise PayloadValidationError(f"{ctx}: expected a list of integers, got element {v!r}")
        out.append(v)
    return out


def _parse_grid(raw: Any) -> SolverGrid:
    data = _require_dict(raw, "grid")
    working_days = _int_list(_require_list(data, "workingDays", "grid"), "grid.workingDays")
    for d in working_days:
        if d < 1 or d > 7:
            raise PayloadValidationError(f"grid.workingDays: ISO weekday must be 1..7, got {d}")
    if len(set(working_days)) != len(working_days):
        raise PayloadValidationError("grid.workingDays: duplicate weekday")
    period_numbers = _int_list(_require_list(data, "periodNumbers", "grid"), "grid.periodNumbers")
    for p in period_numbers:
        if p < 1:
            raise PayloadValidationError(f"grid.periodNumbers: period numbers must be >= 1, got {p}")
    if len(set(period_numbers)) != len(period_numbers):
        raise PayloadValidationError("grid.periodNumbers: duplicate period number")
    return SolverGrid(workingDays=working_days, periodNumbers=period_numbers)


def _parse_availability(raw: Any, ctx: str) -> Optional[dict[str, list[int]]]:
    if raw is None:
        return None
    data = _require_dict(raw, f"{ctx}.availability")
    out: dict[str, list[int]] = {}
    for key, value in data.items():
        try:
            day = int(key)
        except (TypeError, ValueError):
            raise PayloadValidationError(
                f"{ctx}.availability: keys must be ISO weekday strings '1'..'7', got {key!r}"
            ) from None
        if day < 1 or day > 7:
            raise PayloadValidationError(f"{ctx}.availability: ISO weekday must be 1..7, got {key!r}")
        if not isinstance(value, list):
            raise PayloadValidationError(f"{ctx}.availability[{key!r}] must be a list of period numbers")
        out[str(day)] = _int_list(value, f"{ctx}.availability[{key!r}]")
    return out


def parse_payload(data: Any) -> SolverJobPayload:
    """Parse and validate a raw job payload dict against schemaVersion 1.

    Raises PayloadValidationError with an actionable message on any mismatch.
    """
    root = _require_dict(data, "payload")

    schema_version = _require_int(root, "schemaVersion", "payload")
    if schema_version != SOLVER_CONTRACT_SCHEMA_VERSION:
        raise PayloadValidationError(
            f"payload: unsupported schemaVersion {schema_version}; "
            f"this worker supports {SOLVER_CONTRACT_SCHEMA_VERSION}"
        )

    timetable_id = _require_str(root, "timetableId", "payload")
    tenant_id = _require_str(root, "tenantId", "payload")
    grid = _parse_grid(_require(root, "grid", "payload"))

    classes: list[SolverClass] = []
    for i, raw in enumerate(_require_list(root, "classes", "payload")):
        ctx = f"classes[{i}]"
        item = _require_dict(raw, ctx)
        classes.append(
            SolverClass(
                id=_require_str(item, "id", ctx),
                name=_require_str(item, "name", ctx),
                studentCount=_require_int(item, "studentCount", ctx, minimum=0),
            )
        )
    class_ids = [c.id for c in classes]
    if len(set(class_ids)) != len(class_ids):
        raise PayloadValidationError("classes: duplicate class id")

    teachers: list[SolverTeacher] = []
    for i, raw in enumerate(_require_list(root, "teachers", "payload")):
        ctx = f"teachers[{i}]"
        item = _require_dict(raw, ctx)
        teachers.append(
            SolverTeacher(
                id=_require_str(item, "id", ctx),
                name=_require_str(item, "name", ctx),
                maxPeriodsPerDay=_optional_int(item, "maxPeriodsPerDay", ctx),
                maxPeriodsPerWeek=_optional_int(item, "maxPeriodsPerWeek", ctx),
                maxConsecutivePeriods=_optional_int(item, "maxConsecutivePeriods", ctx, minimum=1),
                availability=_parse_availability(item.get("availability"), ctx),
            )
        )
    teacher_ids = [t.id for t in teachers]
    if len(set(teacher_ids)) != len(teacher_ids):
        raise PayloadValidationError("teachers: duplicate teacher id")

    rooms: list[SolverRoom] = []
    for i, raw in enumerate(_require_list(root, "rooms", "payload", allow_empty=True)):
        ctx = f"rooms[{i}]"
        item = _require_dict(raw, ctx)
        rooms.append(
            SolverRoom(
                id=_require_str(item, "id", ctx),
                name=_require_str(item, "name", ctx),
                type=_require_str(item, "type", ctx),
                capacity=_require_int(item, "capacity", ctx, minimum=0),
            )
        )
    room_ids = [r.id for r in rooms]
    if len(set(room_ids)) != len(room_ids):
        raise PayloadValidationError("rooms: duplicate room id")

    lessons: list[SolverLesson] = []
    for i, raw in enumerate(_require_list(root, "lessons", "payload")):
        ctx = f"lessons[{i}]"
        item = _require_dict(raw, ctx)
        lesson = SolverLesson(
            id=_require_str(item, "id", ctx),
            classId=_require_str(item, "classId", ctx),
            courseId=_require_str(item, "courseId", ctx),
            courseName=_require_str(item, "courseName", ctx),
            teacherId=_require_str(item, "teacherId", ctx),
            periodsPerWeek=_require_int(item, "periodsPerWeek", ctx, minimum=1),
            blockSize=_require_int(item, "blockSize", ctx, minimum=1),
            roomId=_optional_str(item, "roomId", ctx),
            roomType=_optional_str(item, "roomType", ctx),
        )
        if lesson.periodsPerWeek % lesson.blockSize != 0:
            raise PayloadValidationError(
                f"{ctx}: blockSize {lesson.blockSize} must divide periodsPerWeek {lesson.periodsPerWeek}"
            )
        if lesson.roomId is not None and lesson.roomType is not None:
            raise PayloadValidationError(f"{ctx}: roomId and roomType are mutually exclusive")
        if lesson.classId not in set(class_ids):
            raise PayloadValidationError(f"{ctx}: classId {lesson.classId!r} not present in classes")
        if lesson.teacherId not in set(teacher_ids):
            raise PayloadValidationError(f"{ctx}: teacherId {lesson.teacherId!r} not present in teachers")
        if lesson.roomId is not None and lesson.roomId not in set(room_ids):
            raise PayloadValidationError(f"{ctx}: roomId {lesson.roomId!r} not present in rooms")
        lessons.append(lesson)
    lesson_ids = [l.id for l in lessons]
    if len(set(lesson_ids)) != len(lesson_ids):
        raise PayloadValidationError("lessons: duplicate allocation id")

    weights_raw = _require_dict(_require(root, "weights", "payload"), "weights")
    weights = SolverWeights(
        spread=_require_number(weights_raw, "spread", "weights", minimum=0),
        teacherBalance=_require_number(weights_raw, "teacherBalance", "weights", minimum=0),
    )

    limits_raw = _require_dict(_require(root, "limits", "payload"), "limits")
    time_limit = _require_number(limits_raw, "timeLimitSeconds", "limits")
    if time_limit <= 0:
        raise PayloadValidationError(f"limits: 'timeLimitSeconds' must be > 0, got {time_limit}")
    limits = SolverLimits(timeLimitSeconds=time_limit)

    return SolverJobPayload(
        schemaVersion=schema_version,
        timetableId=timetable_id,
        tenantId=tenant_id,
        grid=grid,
        classes=classes,
        teachers=teachers,
        rooms=rooms,
        lessons=lessons,
        weights=weights,
        limits=limits,
    )
