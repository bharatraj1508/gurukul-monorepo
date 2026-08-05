"""Map INFEASIBLE outcomes to actionable hints.

The assumption core (sufficient_assumptions_for_infeasibility) identifies
which relaxable (family, teacher) constraint groups are jointly responsible;
those are translated to hints and unioned with the arithmetic pigeonhole
findings from preflight. An empty core adds an UNKNOWN hint alongside the
pigeonhole findings.

Note: CP-SAT cores are *sufficient*, not minimal — unrelated-but-active
constraint groups can appear alongside the true culprit. Every listed hint
still names a genuinely relaxable constraint, so we surface them all.
"""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any

from ortools.sat.python import cp_model

from .constants import (
    HINT_AVAILABILITY_CONFLICT,
    HINT_TEACHER_OVERLOADED,
    HINT_UNKNOWN,
)
from .contracts import SolverInfeasibleHint
from .model import (
    FAMILY_AVAILABILITY,
    FAMILY_MAX_CONSECUTIVE,
    FAMILY_MAX_PER_DAY,
    FAMILY_MAX_PER_WEEK,
)
from .preflight import run_preflight

if TYPE_CHECKING:
    from .model import BuiltModel

logger = logging.getLogger("solver.hints")

_FAMILY_LABEL = {
    FAMILY_MAX_PER_DAY: "maximum periods per day",
    FAMILY_MAX_PER_WEEK: "maximum periods per week",
    FAMILY_MAX_CONSECUTIVE: "maximum consecutive periods",
}


def _core_hint(family: str, teacher_id: str, teacher_name: str) -> SolverInfeasibleHint:
    if family == FAMILY_AVAILABILITY:
        return SolverInfeasibleHint(
            code=HINT_AVAILABILITY_CONFLICT,
            message=(
                f"Teacher {teacher_name}'s availability makes the schedule impossible. "
                f"Widen their available periods or reassign some of their courses."
            ),
            params={"teacherId": teacher_id, "teacherName": teacher_name, "constraint": family},
        )
    label = _FAMILY_LABEL.get(family, family)
    return SolverInfeasibleHint(
        code=HINT_TEACHER_OVERLOADED,
        message=(
            f"Teacher {teacher_name}'s {label} limit makes the schedule impossible. "
            f"Raise the limit or reduce their assigned periods."
        ),
        params={"teacherId": teacher_id, "teacherName": teacher_name, "constraint": family},
    )


def collect_infeasible_hints(
    built: "BuiltModel", solver: cp_model.CpSolver
) -> list[SolverInfeasibleHint]:
    payload = built.payload
    teacher_names = {t.id: t.name for t in payload.teachers}

    hints: list[SolverInfeasibleHint] = []
    seen: set[tuple[str, str]] = set()

    def add(hint: SolverInfeasibleHint) -> None:
        key = (hint.code, json.dumps(hint.params, sort_keys=True, default=str))
        if key not in seen:
            seen.add(key)
            hints.append(hint)

    core = list(solver.sufficient_assumptions_for_infeasibility())
    core_pairs: list[tuple[str, str]] = []
    for literal_index in core:
        pair = built.assumption_by_index.get(literal_index)
        if pair is None:
            logger.warning("core literal index %s not in assumption map", literal_index)
            continue
        core_pairs.append(pair)

    for family, teacher_id in sorted(set(core_pairs)):
        add(_core_hint(family, teacher_id, teacher_names.get(teacher_id, teacher_id)))

    if not core_pairs:
        add(
            SolverInfeasibleHint(
                code=HINT_UNKNOWN,
                message=(
                    "The solver could not attribute the infeasibility to a specific "
                    "teacher constraint. Review the findings below or relax the "
                    "configuration and retry."
                ),
                params={},
            )
        )

    for finding in run_preflight(payload):
        add(
            SolverInfeasibleHint(
                code=finding["code"],
                message=finding["message"],
                params=finding["params"],
            )
        )

    return hints
