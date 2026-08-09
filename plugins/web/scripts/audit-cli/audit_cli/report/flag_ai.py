"""Flag findings that require Claude's subjective review.

A finding is routed to Claude when any of the following is true:
  * Its rule is in the 11 AI-grounded design rules.
  * The automated confidence score is below 0.7.
  * A heuristic detects a background-image on a text-bearing element
    (common for hero banners where contrast can't be measured reliably).
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Mapping

from audit_cli.types import AiVerdict, Evidence, Finding, Recommendation, Severity

AI_GROUNDED_RULES: frozenset[str] = frozenset(
    {
        "DES-CONS-01",
        "DES-PRIM-01",
        "DES-HIER-02",
        "DES-FEED-01",
        "DES-FEED-02",
        "DES-NAV-01",
        "DES-NAV-02",
        "DES-COPY-01",
        "DES-COPY-02",
        "DES-ICON-01",
        "DES-MOTI-01",
    }
)

CONFIDENCE_THRESHOLD: float = 0.7


@dataclass(frozen=True)
class FlagContext:
    """Per-issue context carried alongside the finding for flagging logic."""

    confidence: float | None = None
    has_text_over_background_image: bool = False
    prompt_override: str | None = None
    hypothesis_override: str | None = None


def should_flag_for_ai(finding: Finding, context: FlagContext) -> bool:
    """Return True when a finding should go to Claude for subjective review."""
    if finding.rule_id in AI_GROUNDED_RULES:
        return True
    if context.confidence is not None and context.confidence < CONFIDENCE_THRESHOLD:
        return True
    if context.has_text_over_background_image:
        return True
    return False


def flag_finding(finding: Finding, context: FlagContext) -> Finding:
    """Return a new finding with AI fields populated when flagged.

    If ``should_flag_for_ai`` is false the finding is returned unchanged
    (save for ``needs_ai_review`` being forced to False).
    """
    if not should_flag_for_ai(finding, context):
        return replace(finding, needs_ai_review=False)

    prompt = context.prompt_override or _default_prompt(finding)
    hypothesis = context.hypothesis_override or _default_hypothesis(finding)

    return replace(
        finding,
        needs_ai_review=True,
        ai_prompt=prompt,
        hypothesis=hypothesis,
    )


def build_finding_from_issue(issue: Mapping[str, object]) -> Finding:
    """Translate a raw JS issue dict into a typed ``Finding``."""
    severity = _map_severity(str(issue.get("severity", "medium")))
    evidence_payload = issue.get("evidence") if isinstance(issue.get("evidence"), dict) else {}
    crop_path = (
        str(evidence_payload.get("cropPath")) if isinstance(evidence_payload, dict) and evidence_payload.get("cropPath") else None
    )
    dom_value = (
        str(evidence_payload.get("domValue")) if isinstance(evidence_payload, dict) and evidence_payload.get("domValue") else None
    )
    recommendation_payload = (
        issue.get("recommendation") if isinstance(issue.get("recommendation"), dict) else {}
    )
    action = (
        str(recommendation_payload.get("action"))
        if isinstance(recommendation_payload, dict) and recommendation_payload.get("action")
        else str(issue.get("summary", ""))
    )
    code_suggestion = (
        str(recommendation_payload.get("codeSuggestion"))
        if isinstance(recommendation_payload, dict)
        else ""
    )
    rule_ref = (
        str(recommendation_payload.get("ruleRef"))
        if isinstance(recommendation_payload, dict)
        else str(issue.get("ruleId", ""))
    )

    return Finding(
        rule_id=str(issue.get("ruleId", "unknown-rule")),
        severity=severity,
        selector=str(issue.get("selector", "")),
        evidence=Evidence(dom_value=dom_value, crop_path=crop_path),
        recommendation=Recommendation(action=action, code_suggestion=code_suggestion, rule_ref=rule_ref),
        needs_ai_review=False,
        ai_prompt=None,
        hypothesis=None,
        ai_verdict=None,
    )


def merge_ai_verdict(finding: Finding, verdict_payload: Mapping[str, object]) -> Finding:
    """Attach an ``AiVerdict`` to a finding after Claude reviews it."""
    confidence_raw = verdict_payload.get("confidence", 0.0)
    confidence = float(confidence_raw) if isinstance(confidence_raw, (int, float, str)) else 0.0
    verdict = AiVerdict(
        passed=bool(verdict_payload.get("passed", False)),
        confidence=confidence,
        rationale=str(verdict_payload.get("rationale", "")),
    )
    return replace(finding, ai_verdict=verdict)


def _map_severity(raw: str) -> Severity:
    raw_lower = raw.strip().lower()
    if raw_lower in {"critical", "p0"}:
        return "p0"
    if raw_lower in {"high", "p1"}:
        return "p1"
    return "p2"


def _default_prompt(finding: Finding) -> str:
    return (
        f"Does the element matching '{finding.selector}' satisfy {finding.rule_id}? "
        "Inspect the attached crop and answer passed/confidence/rationale."
    )


def _default_hypothesis(finding: Finding) -> str:
    return finding.recommendation.action or "CLI could not determine outcome deterministically."
