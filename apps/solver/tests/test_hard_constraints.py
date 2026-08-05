from collections import Counter, defaultdict

# Mirrors the Hindi teacher's availability in the conftest fixture school.
HIN_AVAILABILITY = {"1": [1, 2, 3, 4], "3": [2, 3, 4, 5, 6]}


def test_no_class_double_booking(solved_school):
    _, result = solved_school
    seen = Counter((s.classId, s.dayOfWeek, s.periodNumber) for s in result.slots)
    dupes = {k: n for k, n in seen.items() if n > 1}
    assert not dupes, f"class double-booked: {dupes}"


def test_no_teacher_double_booking(solved_school):
    _, result = solved_school
    seen = Counter((s.teacherId, s.dayOfWeek, s.periodNumber) for s in result.slots)
    dupes = {k: n for k, n in seen.items() if n > 1}
    assert not dupes, f"teacher double-booked: {dupes}"


def test_no_room_double_booking(solved_school):
    _, result = solved_school
    seen = Counter(
        (s.roomId, s.dayOfWeek, s.periodNumber) for s in result.slots if s.roomId is not None
    )
    dupes = {k: n for k, n in seen.items() if n > 1}
    assert not dupes, f"room double-booked: {dupes}"


def test_slots_stay_on_the_grid(solved_school):
    payload, result = solved_school
    days = set(payload.grid.workingDays)
    periods = set(payload.grid.periodNumbers)
    for slot in result.slots:
        assert slot.dayOfWeek in days
        assert slot.periodNumber in periods


def test_teacher_availability_respected(solved_school):
    _, result = solved_school
    for slot in result.slots:
        if slot.teacherId != "t-hin":
            continue
        allowed = HIN_AVAILABILITY.get(str(slot.dayOfWeek))
        if allowed is not None:  # missing day key = fully available
            assert slot.periodNumber in allowed, (
                f"Hindi teacher scheduled outside availability: "
                f"day {slot.dayOfWeek} period {slot.periodNumber}"
            )


def test_max_consecutive_periods_respected(solved_school):
    _, result = solved_school
    by_day = defaultdict(list)
    for slot in result.slots:
        if slot.teacherId == "t-hin":
            by_day[slot.dayOfWeek].append(slot.periodNumber)

    for day, periods in by_day.items():
        longest = run = 1
        ordered = sorted(periods)
        for prev, cur in zip(ordered, ordered[1:]):
            run = run + 1 if cur == prev + 1 else 1
            longest = max(longest, run)
        assert longest <= 2, f"Hindi teacher has {longest} consecutive periods on day {day}"
