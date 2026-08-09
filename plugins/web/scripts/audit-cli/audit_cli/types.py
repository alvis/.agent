"""Contract v3 dataclasses used across the audit CLI.

Uses snake_case to match the JSON wire contract; ``passed`` replaces the
reserved keyword ``pass``. All dataclasses are frozen for hashability and
defensive immutability — the CLI is pipeline-oriented, not stateful.
"""

from dataclasses import dataclass, field
from typing import Literal, Mapping

Severity = Literal["p0", "p1", "p2"]
ViewportLabel = Literal["mobile", "tablet", "desktop", "wide"]


@dataclass(frozen=True)
class TriggeredBy:
    """Interaction-origin metadata attached to a finding's evidence."""

    uid: int
    role: str
    name: str


@dataclass(frozen=True)
class Evidence:
    """Ground-truth artefacts backing a single finding."""

    dom_value: str | None = None
    crop_path: str | None = None
    triggered_by: TriggeredBy | None = None


@dataclass(frozen=True)
class Recommendation:
    """Prescriptive remediation guidance for a finding."""

    action: str
    code_suggestion: str
    rule_ref: str


@dataclass(frozen=True)
class AiVerdict:
    """Verdict Claude supplies after subjective review."""

    passed: bool
    confidence: float
    rationale: str


@dataclass(frozen=True)
class Finding:
    """A single rule violation surfaced by the audit pipeline."""

    rule_id: str
    severity: Severity
    selector: str
    evidence: Evidence
    recommendation: Recommendation
    needs_ai_review: bool
    pages: tuple[str, ...] = field(default_factory=tuple)
    viewports: tuple[ViewportLabel, ...] = field(default_factory=tuple)
    ai_prompt: str | None = None
    hypothesis: str | None = None
    ai_verdict: AiVerdict | None = None


@dataclass(frozen=True)
class RecurringElement:
    """Cross-page reusable component discovered during crawl."""

    element_id: str
    selector: str
    role: str
    page_count: int
    sample_pages: tuple[str, ...]


@dataclass(frozen=True)
class Viewport:
    """Viewport descriptor for a single audit run."""

    label: ViewportLabel
    width: int
    height: int


@dataclass(frozen=True)
class Area:
    """Named region of a page (e.g. ``hero``, ``pricing-grid``)."""

    name: str
    selector: str
    bounding_box: tuple[int, int, int, int] | None = None


@dataclass(frozen=True)
class Route:
    """Source-derived route candidate produced by ``discover_source_routes``."""

    path: str
    source_file: str
    framework: str
    warning: str | None = None


@dataclass(frozen=True)
class InteractionCandidate:
    """A single plan entry describing an interactive element to exercise."""

    uid: int
    role: str
    name: str
    fingerprint: str
    expanded: bool | None = None


@dataclass(frozen=True)
class InteractionPlan:
    """Ordered plan of unique interactions to trigger on a page."""

    candidates: tuple[InteractionCandidate, ...]
    cross_origin_candidates: tuple[str, ...]
    dropped_social: tuple[str, ...]


@dataclass(frozen=True)
class Page:
    """Findings and metadata for a single crawled URL."""

    url: str
    title: str | None
    viewports: tuple[Viewport, ...]
    areas: tuple[Area, ...]
    findings: tuple[Finding, ...]


@dataclass
class PageAuditResult:
    """Raw aggregator output per viewport plus the URLs we collected.

    Mutable (unlike the wire-contract dataclasses) because the crawl
    loop accretes interaction reports and hover/modal findings as it
    exercises the page.
    """

    url: str
    viewport_reports: dict[str, Mapping[str, object]] = field(default_factory=dict)
    anchor_urls: list[str] = field(default_factory=list)
    bonus_urls: list[str] = field(default_factory=list)
    triggered_reports: list[tuple[str, Mapping[str, object]]] = field(default_factory=list)
    hover_findings: tuple[dict[str, object], ...] = field(default_factory=tuple)
    modal_findings: tuple[dict[str, object], ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class Report:
    """Root contract-v3 object serialised to report.json."""

    contract_version: str
    target: str
    generated_at: str
    overall_score: int
    risk: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    pages: tuple[Page, ...]
    findings: tuple[Finding, ...]
    recurring_elements: tuple[RecurringElement, ...]
    cross_origin_candidates: tuple[str, ...]
    warnings: tuple[str, ...]
