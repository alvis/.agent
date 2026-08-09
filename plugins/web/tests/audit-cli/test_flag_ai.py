"""Verify AI-flag routing across rule list, confidence, and heuristic paths."""

import pytest

from audit_cli.report.flag_ai import (
    AI_GROUNDED_RULES,
    CONFIDENCE_THRESHOLD,
    FlagContext,
    flag_finding,
    should_flag_for_ai,
)
from audit_cli.types import Evidence, Finding, Recommendation


def _make_finding(rule_id: str = "DES-GENERIC-00") -> Finding:
    return Finding(
        rule_id=rule_id,
        severity="p1",
        selector=".btn",
        evidence=Evidence(),
        recommendation=Recommendation(action="fix it", code_suggestion="", rule_ref=rule_id),
        needs_ai_review=False,
    )


def test_every_ai_grounded_rule_is_flagged() -> None:
    for rule_id in AI_GROUNDED_RULES:
        finding = _make_finding(rule_id)
        flagged = flag_finding(finding, FlagContext())
        assert (
            flagged.needs_ai_review,
            flagged.ai_prompt is not None,
            flagged.hypothesis is not None,
        ) == (True, True, True)


def test_confidence_below_threshold_flags_for_review() -> None:
    finding = _make_finding()
    flagged = flag_finding(finding, FlagContext(confidence=CONFIDENCE_THRESHOLD - 0.01))
    assert flagged.needs_ai_review is True


def test_confidence_above_threshold_does_not_flag() -> None:
    finding = _make_finding()
    flagged = flag_finding(finding, FlagContext(confidence=0.95))
    assert (flagged.needs_ai_review, flagged.ai_prompt) == (False, None)


def test_background_image_heuristic_flags_for_review() -> None:
    finding = _make_finding()
    assert should_flag_for_ai(finding, FlagContext(has_text_over_background_image=True)) is True


@pytest.mark.parametrize(
    "confidence, heuristic, expected",
    [
        (None, False, False),
        (0.71, False, False),
        (0.69, False, True),
        (None, True, True),
    ],
)
def test_combined_flag_matrix(confidence: float | None, heuristic: bool, expected: bool) -> None:
    context = FlagContext(confidence=confidence, has_text_over_background_image=heuristic)
    assert should_flag_for_ai(_make_finding(), context) is expected
