from collections import Counter, defaultdict

LAB_ID = "room-lab"  # the single SCIENCE_LAB in the conftest fixture school


def _sci_slots(result, class_id):
    return [s for s in result.slots if s.allocationId == f"alloc-{class_id}-sci".lower()]


def test_science_blocks_are_consecutive_same_day(solved_school):
    _, result = solved_school
    for class_id in ("6A", "6B"):
        slots = _sci_slots(result, class_id)
        assert len(slots) == 4

        by_day = defaultdict(list)
        for slot in slots:
            by_day[slot.dayOfWeek].append(slot.periodNumber)

        for day, periods in by_day.items():
            assert len(periods) % 2 == 0, (
                f"{class_id} science periods on day {day} do not form whole blocks: {periods}"
            )
            ordered = sorted(periods)
            for i in range(0, len(ordered), 2):
                assert ordered[i + 1] == ordered[i] + 1, (
                    f"{class_id} science block on day {day} is not consecutive: {ordered}"
                )


def test_science_gets_the_lab(solved_school):
    _, result = solved_school
    for class_id in ("6A", "6B"):
        for slot in _sci_slots(result, class_id):
            assert slot.roomId == LAB_ID


def test_lab_never_double_booked(solved_school):
    _, result = solved_school
    lab_usage = Counter(
        (s.dayOfWeek, s.periodNumber) for s in result.slots if s.roomId == LAB_ID
    )
    dupes = {k: n for k, n in lab_usage.items() if n > 1}
    assert not dupes, f"lab double-booked at: {dupes}"


def test_room_free_lessons_have_no_room(solved_school):
    payload, result = solved_school
    room_free_allocations = {
        lesson.id
        for lesson in payload.lessons
        if lesson.roomId is None and lesson.roomType is None
    }
    for slot in result.slots:
        if slot.allocationId in room_free_allocations:
            assert slot.roomId is None
