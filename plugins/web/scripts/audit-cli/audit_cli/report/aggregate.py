"""Score + dedup aggregator — Python port of design-audit-aggregator.js.

Preserves every constant and rounding rule from the JS source so that
multi-page score output matches single-page output on identical inputs.
This parity is enforced by ``tests/test_aggregate_score_parity.py``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping, Sequence

SEVERITY_WEIGHTS: dict[str, int] = {
    "critical": 22,
    "high": 14,
    "medium": 8,
    "low": 4,
    "info": 0,
}

SEVERITY_CAPS: dict[str, int] = {
    "critical": 24,
    "high": 18,
    "medium": 12,
    "low": 6,
    "info": 0,
}

SEVERITY_ORDER: tuple[str, ...] = ("critical", "high", "medium", "low", "info")
DIMINISHING_FACTOR: float = 0.7
MAX_PENALTY: int = 45

# Rule → category hints for synthetic findings that the Python crawler
# adds after the in-browser aggregator runs (hover pass, modal checks).
# The actual aggregation is category-agnostic — this map lets callers
# (e.g. tests, report writers) resolve the canonical bucket without
# round-tripping through the JS audit.
CATEGORY_DEFINITIONS: dict[str, str] = {
    "DES-STAT-01": "interaction",
    "DES-MODA-01": "interaction",
    "DES-MODA-02": "interaction",
    "DES-MODA-03": "interaction",
    "DES-MODA-04": "interaction",
    "DES-NAVI-04": "interaction",
}


@dataclass(frozen=True)
class CategorySummary:
    """Per-category score and issue stats."""

    score: int
    issue_count: int
    top_severity: str | None


@dataclass(frozen=True)
class AggregateResult:
    """Site-level aggregate of scores, counts, and per-category summaries."""

    overall_score: int
    risk: str
    category_scores: dict[str, int]
    category_summaries: dict[str, CategorySummary]
    severity_counts: dict[str, int]
    total_before_dedup: int
    total_deduplicated: int


def normalize_severity(value: object) -> str:
    """Clamp any severity to the canonical set, defaulting to ``medium``."""
    if isinstance(value, str) and value in SEVERITY_ORDER:
        return value
    return "medium"


def severity_rank(value: object) -> int:
    """Return severity sort rank (0=critical, 4=info, medium fallback)."""
    canonical = normalize_severity(value)
    try:
        return SEVERITY_ORDER.index(canonical)
    except ValueError:
        return 2


def penalty_for_occurrences(severity: str, occurrences: int) -> float:
    """Sum diminishing-return penalty across occurrences, capped per severity."""
    canonical = normalize_severity(severity)
    base_weight = SEVERITY_WEIGHTS[canonical]
    max_penalty = SEVERITY_CAPS[canonical]
    penalty = 0.0
    for i in range(occurrences):
        penalty += base_weight / (1.0 + i * DIMINISHING_FACTOR)
    return min(float(max_penalty), penalty)


@dataclass
class _RuleBucket:
    """Internal accumulator for per-rule severity and occurrence tracking."""

    occurrences: int
    severity: str


def compute_category_score(issues: Sequence[Mapping[str, object]]) -> int:
    """Score one category's issues 0-100 using the JS formula."""
    if not issues:
        return 100

    rule_map: dict[str, _RuleBucket] = {}
    for issue in issues:
        rule_id = str(issue.get("ruleId") or "unknown-rule")
        severity = normalize_severity(issue.get("severity"))
        bucket = rule_map.get(rule_id)
        if bucket is None:
            bucket = _RuleBucket(occurrences=0, severity=severity)
            rule_map[rule_id] = bucket
        bucket.occurrences += 1
        if severity_rank(severity) < severity_rank(bucket.severity):
            bucket.severity = severity

    total = 0.0
    for bucket in rule_map.values():
        total += penalty_for_occurrences(bucket.severity, bucket.occurrences)

    capped = min(float(MAX_PENALTY), total)
    return max(0, round(100 - capped))


def compute_overall_score(category_scores: Mapping[str, int]) -> int:
    """Average category scores, rounded to match JS ``Math.round``."""
    keys = list(category_scores.keys())
    if not keys:
        return 100
    return round(sum(category_scores[k] for k in keys) / len(keys))


def determine_risk(severity_counts: Mapping[str, int]) -> str:
    """Apply the JS risk-threshold ladder."""
    critical = severity_counts.get("critical", 0)
    high = severity_counts.get("high", 0)
    medium = severity_counts.get("medium", 0)
    low = severity_counts.get("low", 0)
    if critical >= 1 or high >= 4:
        return "CRITICAL"
    if high >= 1 or medium >= 6:
        return "HIGH"
    if medium >= 1 or low >= 4:
        return "MEDIUM"
    return "LOW"


@dataclass
class _DedupEntry:
    """Internal accumulator for dedup tracking."""

    issue: dict[str, object]
    count: int


def deduplicate_issues(
    issues: Sequence[Mapping[str, object]],
    viewport: str,
) -> list[dict[str, object]]:
    """Deduplicate by (viewport, ruleId, selector, summary) like the JS does."""
    key_map: dict[str, _DedupEntry] = {}
    order: list[str] = []

    for issue in issues:
        key = "::".join(
            [
                viewport or "default",
                str(issue.get("ruleId") or "unknown-rule"),
                str(issue.get("selector") or ""),
                str(issue.get("summary") or issue.get("details") or ""),
            ]
        )
        entry = key_map.get(key)
        if entry is None:
            key_map[key] = _DedupEntry(issue=dict(issue), count=1)
            order.append(key)
            continue
        entry.count += 1
        if severity_rank(issue.get("severity")) < severity_rank(entry.issue.get("severity")):
            entry.issue = dict(issue)

    deduped: list[dict[str, object]] = []
    for key in order:
        entry = key_map[key]
        issue_copy = entry.issue
        if entry.count > 1:
            evidence = issue_copy.get("evidence")
            if not isinstance(evidence, dict):
                evidence = {}
            evidence["duplicateCount"] = entry.count
            issue_copy["evidence"] = evidence
        deduped.append(issue_copy)
    return deduped


def sort_issues(issues: Iterable[Mapping[str, object]]) -> list[dict[str, object]]:
    """Sort by severity (critical first) then category name."""
    materialised = [dict(issue) for issue in issues]
    materialised.sort(
        key=lambda item: (
            severity_rank(item.get("severity")),
            str(item.get("category") or "").lower(),
        )
    )
    return materialised


def top_severity(issues: Sequence[Mapping[str, object]]) -> str | None:
    """Return the highest severity present in ``issues`` or ``None``."""
    if not issues:
        return None
    best = "info"
    for issue in issues:
        canonical = normalize_severity(issue.get("severity"))
        if severity_rank(canonical) < severity_rank(best):
            best = canonical
    return best


def aggregate_report(
    viewport_reports: Mapping[str, Mapping[str, object]],
) -> AggregateResult:
    """Merge per-viewport aggregator outputs into a single site summary."""
    category_issues: dict[str, list[Mapping[str, object]]] = {}
    all_issues: list[Mapping[str, object]] = []
    viewport_label = "default"

    for label, report in viewport_reports.items():
        viewport_label = label
        categories = report.get("categories")
        if not isinstance(categories, dict):
            continue
        for cat_key, cat_value in categories.items():
            if not isinstance(cat_value, dict):
                continue
            issues = cat_value.get("issues")
            if not isinstance(issues, list):
                continue
            typed_issues = [item for item in issues if isinstance(item, dict)]
            category_issues.setdefault(str(cat_key), []).extend(typed_issues)
            all_issues.extend(typed_issues)

    category_scores: dict[str, int] = {
        name: compute_category_score(issues) for name, issues in category_issues.items()
    }
    summaries: dict[str, CategorySummary] = {
        name: CategorySummary(
            score=category_scores[name],
            issue_count=len(issues),
            top_severity=top_severity(issues),
        )
        for name, issues in category_issues.items()
    }

    deduped = deduplicate_issues(all_issues, viewport_label)
    severity_counts: dict[str, int] = {sev: 0 for sev in SEVERITY_ORDER}
    for issue in deduped:
        severity_counts[normalize_severity(issue.get("severity"))] += 1

    return AggregateResult(
        overall_score=compute_overall_score(category_scores),
        risk=determine_risk(severity_counts),
        category_scores=category_scores,
        category_summaries=summaries,
        severity_counts=severity_counts,
        total_before_dedup=len(all_issues),
        total_deduplicated=len(deduped),
    )
