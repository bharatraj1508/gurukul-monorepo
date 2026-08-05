import pytest

from solver.contracts import parse_payload
from solver.model import solve


def _cap_art_teacher(payload: dict) -> None:
    # ART demand is 4 periods/week (2 per class); cap the teacher at 1.
    for teacher in payload["teachers"]:
        if teacher["id"] == "t-art":
            teacher["maxPeriodsPerWeek"] = 1


def _overallocate_6a(payload: dict) -> None:
    # 6A: 5 + 5 + 4 + 15 + 2 = 31 periods on a 30-slot grid.
    for lesson in payload["lessons"]:
        if lesson["id"] == "alloc-6a-hin":
            lesson["periodsPerWeek"] = 15


def _remove_all_labs(payload: dict) -> None:
    # Both classes still demand SCIENCE_LAB blocks; zero labs remain.
    payload["rooms"] = [r for r in payload["rooms"] if r["type"] != "SCIENCE_LAB"]


def _impossible_block_size(payload: dict) -> None:
    # A block of 7 consecutive periods cannot fit in a 6-period day.
    for lesson in payload["lessons"]:
        if lesson["id"] == "alloc-6a-sci":
            lesson["periodsPerWeek"] = 7
            lesson["blockSize"] = 7


@pytest.mark.parametrize(
    ("mutate", "expected_code", "expected_param"),
    [
        pytest.param(_cap_art_teacher, "TEACHER_OVERLOADED", ("teacherId", "t-art"), id="teacher-overloaded"),
        pytest.param(_overallocate_6a, "CLASS_OVERALLOCATED", ("classId", "6A"), id="class-overallocated"),
        pytest.param(_remove_all_labs, "ROOM_TYPE_SCARCE", ("roomType", "SCIENCE_LAB"), id="room-type-scarce"),
        pytest.param(_impossible_block_size, "BLOCK_SIZE_IMPOSSIBLE", ("blockSize", 7), id="block-size-impossible"),
    ],
)
def test_infeasible_variants_produce_actionable_hints(
    school_payload, mutate, expected_code, expected_param
):
    mutate(school_payload)
    result = solve(parse_payload(school_payload))

    assert result.status == "INFEASIBLE"
    assert result.slots == []
    assert result.stats.solverStatus == "INFEASIBLE"

    matching = [h for h in result.infeasibleHints if h.code == expected_code]
    assert matching, (
        f"expected an {expected_code} hint, got "
        f"{[(h.code, h.message) for h in result.infeasibleHints]}"
    )
    key, value = expected_param
    assert any(h.params.get(key) == value for h in matching)

    for hint in result.infeasibleHints:
        assert isinstance(hint.message, str) and hint.message
        assert isinstance(hint.params, dict)


def test_overloaded_teacher_hint_names_the_teacher(school_payload):
    _cap_art_teacher(school_payload)
    result = solve(parse_payload(school_payload))

    assert result.status == "INFEASIBLE"
    overloaded = [h for h in result.infeasibleHints if h.code == "TEACHER_OVERLOADED"]
    assert any("Art Teacher" in h.message for h in overloaded)


def test_infeasible_is_a_result_not_an_exception(school_payload):
    # INFEASIBLE travels the same result pipeline as success (no raise).
    _remove_all_labs(school_payload)
    result = solve(parse_payload(school_payload))
    assert result.status == "INFEASIBLE"
    assert result.error is None
    payload_dict = result.to_dict()
    assert "error" not in payload_dict
    assert payload_dict["infeasibleHints"]
