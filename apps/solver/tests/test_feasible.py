import json


def test_school_solves_and_places_all_sessions(solved_school):
    payload, result = solved_school

    assert result.status in ("OPTIMAL", "FEASIBLE")
    assert result.schemaVersion == 1
    assert result.timetableId == "tt-1"
    assert result.error is None
    assert result.infeasibleHints == []

    # Every allocated period materializes as exactly one slot.
    total_periods = sum(lesson.periodsPerWeek for lesson in payload.lessons)
    assert len(result.slots) == total_periods == 40

    per_allocation = {}
    for slot in result.slots:
        per_allocation[slot.allocationId] = per_allocation.get(slot.allocationId, 0) + 1
    for lesson in payload.lessons:
        assert per_allocation.get(lesson.id) == lesson.periodsPerWeek

    # Slot fields echo the lesson correctly.
    lesson_by_id = {lesson.id: lesson for lesson in payload.lessons}
    for slot in result.slots:
        lesson = lesson_by_id[slot.allocationId]
        assert slot.classId == lesson.classId
        assert slot.courseId == lesson.courseId
        assert slot.teacherId == lesson.teacherId


def test_stats_shape(solved_school):
    _, result = solved_school
    stats = result.stats
    assert stats.solverStatus in ("OPTIMAL", "FEASIBLE")
    assert stats.objectiveValue is not None and stats.objectiveValue >= 0
    assert stats.wallTimeMs >= 0
    assert stats.conflicts >= 0
    assert stats.branches >= 0


def test_result_is_json_serializable(solved_school):
    _, result = solved_school
    payload = result.to_dict()
    round_tripped = json.loads(json.dumps(payload))
    assert round_tripped["status"] == result.status
    assert "error" not in payload  # only present for ERROR results
    assert set(payload.keys()) == {
        "schemaVersion",
        "timetableId",
        "status",
        "slots",
        "violations",
        "infeasibleHints",
        "stats",
    }
