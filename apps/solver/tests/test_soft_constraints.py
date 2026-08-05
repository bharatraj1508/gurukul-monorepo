from solver.contracts import parse_payload
from solver.model import solve


def _violations(result, code):
    return [v for v in result.violations if v.code == code]


def test_violations_have_contract_shape(solved_school):
    _, result = solved_school
    for violation in result.violations:
        assert violation.code in ("SUBJECT_NOT_SPREAD", "TEACHER_LOAD_IMBALANCE")
        assert isinstance(violation.message, str) and violation.message
        assert isinstance(violation.params, dict)


def test_spread_optimum_avoids_same_day_stacking(solved_school):
    # Full spread (one session per course per day) is achievable in the
    # fixture school, so a proven optimum must not stack subjects.
    _, result = solved_school
    if result.status == "OPTIMAL":
        assert _violations(result, "SUBJECT_NOT_SPREAD") == []


def test_subject_not_spread_reported_when_forced(school_payload):
    # 6 MATH periods across 5 days force at least one doubled day.
    for lesson in school_payload["lessons"]:
        if lesson["id"] == "alloc-6a-math":
            lesson["periodsPerWeek"] = 6
    result = solve(parse_payload(school_payload))

    assert result.status in ("OPTIMAL", "FEASIBLE")
    stacked = [
        v
        for v in _violations(result, "SUBJECT_NOT_SPREAD")
        if v.params["classId"] == "6A" and v.params["courseId"] == "course-math"
    ]
    assert stacked, "expected a SUBJECT_NOT_SPREAD violation for 6A Math"
    violation = stacked[0]
    assert violation.params["count"] >= 2
    assert violation.params["dayOfWeek"] in (1, 2, 3, 4, 5)
    assert "Math" in violation.message
    assert "Class 6A" in violation.message


def test_teacher_load_imbalance_reported(solved_school):
    # Loads are MATH 10, ENG 10, SCI 8, HIN 8, ART 4 (mean 8): only the Art
    # teacher deviates by more than 2 periods.
    _, result = solved_school
    imbalances = _violations(result, "TEACHER_LOAD_IMBALANCE")
    assert [v.params["teacherId"] for v in imbalances] == ["t-art"]

    violation = imbalances[0]
    assert violation.params["load"] == 4
    assert violation.params["meanLoad"] == 8.0
    assert violation.params["deviation"] == 4.0
    assert "Art Teacher" in violation.message
