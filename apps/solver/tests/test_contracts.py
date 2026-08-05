import pytest

from solver.contracts import (
    PayloadValidationError,
    SolverInfeasibleHint,
    SolverResult,
    SolverStats,
    parse_payload,
)


def test_valid_payload_round_trips(school_payload):
    payload = parse_payload(school_payload)

    assert payload.schemaVersion == 1
    assert payload.timetableId == "tt-1"
    assert payload.tenantId == "tenant-1"
    assert payload.grid.workingDays == [1, 2, 3, 4, 5]
    assert payload.grid.periodNumbers == [1, 2, 3, 4, 5, 6]
    assert len(payload.classes) == 2
    assert len(payload.teachers) == 5
    assert len(payload.rooms) == 2
    assert len(payload.lessons) == 10
    assert payload.weights.spread == 10
    assert payload.weights.teacherBalance == 1
    assert payload.limits.timeLimitSeconds == 20

    hindi = next(t for t in payload.teachers if t.id == "t-hin")
    assert hindi.maxConsecutivePeriods == 2
    assert hindi.availability == {"1": [1, 2, 3, 4], "3": [2, 3, 4, 5, 6]}

    sci = next(l for l in payload.lessons if l.id == "alloc-6a-sci")
    assert sci.blockSize == 2
    assert sci.roomType == "SCIENCE_LAB"
    assert sci.roomId is None


def test_unknown_extra_fields_are_ignored(school_payload):
    school_payload["futureField"] = {"anything": True}
    school_payload["classes"][0]["futureField"] = 1
    parse_payload(school_payload)  # must not raise


@pytest.mark.parametrize(
    ("mutate", "expected_fragment"),
    [
        pytest.param(lambda p: p.update(schemaVersion=2), "schemaVersion", id="wrong-schema-version"),
        pytest.param(lambda p: p.pop("timetableId"), "timetableId", id="missing-timetable-id"),
        pytest.param(lambda p: p.update(grid={"workingDays": [], "periodNumbers": [1]}), "workingDays", id="empty-working-days"),
        pytest.param(lambda p: p["grid"]["periodNumbers"].append(1), "duplicate", id="duplicate-period"),
        pytest.param(lambda p: p["grid"]["workingDays"].append(9), "1..7", id="weekday-out-of-range"),
        pytest.param(lambda p: p.update(lessons=[]), "must not be empty", id="no-lessons"),
        pytest.param(lambda p: p["lessons"][0].update(classId="ghost"), "not present in classes", id="unknown-class"),
        pytest.param(lambda p: p["lessons"][0].update(teacherId="ghost"), "not present in teachers", id="unknown-teacher"),
        pytest.param(lambda p: p["lessons"][0].update(roomId="ghost"), "not present in rooms", id="unknown-room"),
        pytest.param(lambda p: p["lessons"][0].update(periodsPerWeek=5, blockSize=2), "must divide", id="block-does-not-divide"),
        pytest.param(lambda p: p["lessons"][2].update(roomId="room-lab"), "mutually exclusive", id="room-id-and-type"),
        pytest.param(lambda p: p["lessons"][0].update(periodsPerWeek=0), ">= 1", id="zero-periods"),
        pytest.param(lambda p: p["teachers"][0].update(availability=[1, 2]), "availability", id="availability-not-object"),
        pytest.param(lambda p: p["teachers"][0].update(availability={"9": [1]}), "1..7", id="availability-bad-day"),
        pytest.param(lambda p: p["classes"].append(dict(p["classes"][0])), "duplicate", id="duplicate-class-id"),
        pytest.param(lambda p: p["limits"].update(timeLimitSeconds=0), "timeLimitSeconds", id="zero-time-limit"),
        pytest.param(lambda p: p["weights"].pop("spread"), "spread", id="missing-weight"),
    ],
)
def test_invalid_payloads_are_rejected_with_clear_messages(
    school_payload, mutate, expected_fragment
):
    mutate(school_payload)
    with pytest.raises(PayloadValidationError) as excinfo:
        parse_payload(school_payload)
    assert expected_fragment in str(excinfo.value)


def test_non_object_payload_is_rejected():
    with pytest.raises(PayloadValidationError):
        parse_payload("not a payload")
    with pytest.raises(PayloadValidationError):
        parse_payload(None)


def test_error_result_serializes_error_field():
    stats = SolverStats(
        solverStatus="ERROR", objectiveValue=None, wallTimeMs=5, conflicts=0, branches=0
    )
    result = SolverResult(
        schemaVersion=1,
        timetableId="tt-1",
        status="ERROR",
        slots=[],
        violations=[],
        infeasibleHints=[],
        stats=stats,
        error="boom",
    )
    data = result.to_dict()
    assert data["error"] == "boom"
    assert data["stats"]["objectiveValue"] is None


def test_infeasible_result_omits_error_field():
    stats = SolverStats(
        solverStatus="INFEASIBLE", objectiveValue=None, wallTimeMs=5, conflicts=1, branches=2
    )
    result = SolverResult(
        schemaVersion=1,
        timetableId="tt-1",
        status="INFEASIBLE",
        slots=[],
        violations=[],
        infeasibleHints=[
            SolverInfeasibleHint(code="UNKNOWN", message="m", params={})
        ],
        stats=stats,
    )
    data = result.to_dict()
    assert "error" not in data
    assert data["infeasibleHints"][0]["code"] == "UNKNOWN"
