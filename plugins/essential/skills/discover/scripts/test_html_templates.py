#!/usr/bin/env python3
"""Validate the staged Discover presentation contract without dependencies."""

import argparse
from collections import Counter
import json
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from types import ModuleType


DISCOVER_ROOT = Path(__file__).resolve().parents[1]
EXAMPLES_ROOT = DISCOVER_ROOT / "examples" / "html"
EXAMPLES_SRC_ROOT = DISCOVER_ROOT / "examples" / "src"
TEMPLATES_SRC_ROOT = DISCOVER_ROOT / "templates" / "src"
# The template's modular source directory (templates/html/page.html <-> src/page/).
TEMPLATE_SRC = TEMPLATES_SRC_ROOT / "page"
TEMPLATE = DISCOVER_ROOT / "templates" / "html" / "page.html"
CSS = DISCOVER_ROOT / "assets" / "html" / "discovery.css"
JAVASCRIPT = DISCOVER_ROOT / "assets" / "html" / "discovery.js"
VENDOR_DIR = DISCOVER_ROOT / "assets" / "html" / "vendor"
# The Tailwind runtime is downloaded on demand; the pinned vendor file must no
# longer be committed, and the gitignored cache below is an optional fallback.
TAILWIND_CACHE = VENDOR_DIR / "tailwind-browser.cache.js"
# The grammar name from inside the Mermaid bundle that the builder validates a
# fetched runtime against — absent from discovery.js, so presence of the
# vendored bundle is distinguishable from the board's own always-inlined Mermaid
# wiring. It is read from the builder at use rather than restated here, so the
# two can never come to mean different bundles. (The obvious-looking "Mermaid
# version" string does not exist anywhere in the UMD build.)
BUILDER = DISCOVER_ROOT / "scripts" / "build_artifact.py"
ACTION_ROOT = DISCOVER_ROOT / "references" / "presentation" / "actions"
COVERAGE_REFERENCE = DISCOVER_ROOT / "references" / "presentation" / "coverage.md"
COMPONENTS_REFERENCE = DISCOVER_ROOT / "references" / "presentation" / "components.md"
RANKED_REFERENCE = ACTION_ROOT / "ranked-options.md"

ACTIONS = (
    "risk-context-report",
    "domain-explainer",
    "ranked-options",
    "brainstorm-spectrum",
    "guided-interview",
    "semantics-map",
    "interactive-prototype",
    "readiness-check",
    # Stage-4 lifecycle actions (plan → implementation → change). They join the
    # required set at --stage complete, taking the required-action count from
    # eight to eleven; the representative stage stays domain-explainer only.
    "plan-review",
    "build-journal",
    "change-walkthrough",
)
REPRESENTATIVE_ACTION = "domain-explainer"
# Additional convention-demonstration boards (provenance/trade-offs/pins/hub best
# bits). Iterated + validated + pattern-scanned at --stage complete only, separate
# from the required-11 ACTIONS/REPRESENTATIVE_ACTION contract, which stays
# unchanged. triage-board is the fourth convention board: spatial-arrangement-as-
# decision, a kanban strip whose lane membership serializes into the one prompt.
CONVENTION_EXAMPLES = (
    "specimen-board",
    "board-hub",
    "architecture-board",
    "triage-board",
)
FORBIDDEN_HTML_TEXT = (
    "thariqs.github.io",
    "html-effectiveness",
    "know your unknowns",
    "copyright",
    "essential-editorial",
    "no confirmed decisions yet",
    "no notes yet",
)
PRESENTATION_PATTERNS = (
    "colors", "type", "nav-pattern", "prompt", "artifact", "cards", "badges",
    "callout", "finding", "assembly", "codeblock", "stats", "segmented",
    "table", "columns", "sequence", "accordion", "confirm", "stepper",
    "annotated", "scrubber", "avatars", "diagrams", "choice-toggle",
    "flow-strip", "schema-box", "inline-chip", "timeline-rail", "split-reveal",
    "tool-palette", "toggle-switch", "unified-diff", "sidebar-toc",
    "decision-box", "expect-reality", "approach-comparison", "flow-terminus",
    "blindspot-report", "brainstorm-spectrum", "tweakable-plan",
    "data-model-card", "guided-question-card", "pr-file-review",
    "callstack-walkthrough", "light-code-card", "annotation-drawer",
    "semantics-map", "design-variant-gallery", "variant-matrix",
    "reviewable-option-frame", "preset-live-preview", "prototype-mock",
    "term-rung", "teach-me-explainer", "signoff-block", "pitch-doc",
    "status-checklist", "activity-filter-bar", "quiz-gate", "sticky-reply",
    "live-editor-panel", "entity-card",
    # Shell-level devices every board can reach for: the docnav board-set index
    # (board-hub), content-kind column density (semantics-map), and a runtime-
    # rendered Mermaid figure (architecture-board).
    "board-set", "grid-density", "mermaid-diagram",
    # "Best bits" fold-in: provenance pills, honest trade-offs/invented-data flag,
    # author annotation pins + browser-frame chrome, multi-board hub, specimen
    # brand-palette scoping. Marked on the two new CONVENTION_EXAMPLES boards
    # and/or woven into ranked-options.html / risk-context-report.html.
    "provenance-pill", "provenance-row", "tradeoffs-honestly", "invented-data-flag",
    "annotation-pins", "browser-frame", "board-hub", "board-index", "specimen-scope",
    # Stage-3 catalog additions, grouped by owning board exactly as coverage.md
    # records them. IDs are flat here (the coverage map records ownership); the
    # cross-cutting structural checks below fire per-marker where meaningful.
    # domain-explainer:
    "source-ref-chip", "faq-block", "glossary-sync", "live-sim",
    "accordion-exclusive", "anchor-flash",
    # risk-context-report:
    "risk-matrix", "owner-routing", "tldr-block",
    # ranked-options:
    "verdict-table", "variant-rationale", "scope-cuts",
    # brainstorm-spectrum:
    "spectrum-minimap", "reaction-chips",
    # guided-interview:
    "wizard-steps", "nl-reply",
    # semantics-map:
    "syntax-tokens", "rich-diff", "code-pair-highlight", "code-tabs",
    # interactive-prototype:
    "drag-probe", "motion-specimen", "demo-loop", "specimen-code-map",
    # readiness-check:
    "milestone-timeline", "inline-chart", "filter-chips",
    # specimen-board:
    "global-rig", "artboard-frame", "theme-direction-gallery", "mock-frame",
    # architecture-board:
    "node-edge-diagram", "diagram-detail", "prompt-echo", "source-manifest",
    # Stage-4 lifecycle-action catalog additions, grouped by owning board exactly
    # as coverage.md records them.
    # plan-review:
    "plan-review", "tweak-rank", "linked-diagram-choice",
    # build-journal:
    "build-journal", "deviation-log", "journal-badge", "human-todo",
    # change-walkthrough:
    "change-walkthrough", "vcs-header", "diff-comment", "file-tour", "deck-mode",
    # triage-board (fourth convention board):
    "kanban-lanes",
)

# Structural hooks prove that each example demonstrates its action-specific
# information architecture. Pattern markers alone only prove catalog presence.
#
# Counts are (attribute, minimum, maximum). Section-bearing hooks are VARIABLE
# by design: their entries are MINIMUMS (maximum is None) so any board may carry
# more sections of that type — e.g. more than the demonstrated number of option
# frames or decision-question sections. Do NOT reintroduce a fixed maximum on a
# section-repeatable hook; a board must never fail for having extra sections.
# Intrinsic equalities (one panel per tab, one note per pin, one dot per card)
# are enforced elsewhere as count == count pairs, not as caps here.
ACTION_STRUCTURE: dict[str, tuple[tuple[str, int, int | None], ...]] = {
    "risk-context-report": (
        ("data-risk-finding", 5, None),
        ("data-risk-response", 1, None),
    ),
    "domain-explainer": (
        ("data-mechanism-stage", 4, None),
        ("data-domain-term", 4, None),
        ("data-domain-simulation", 1, None),
        ("data-response-kind", 1, None),
    ),
    "ranked-options": (
        # Direction frames and the final selection are variable: a board may
        # compare more than the demonstrated number of directions, so these are
        # minimums (no cap). The one-to-one direction-choice mapping enforced in
        # the ranked-options block keeps the final selection honest regardless.
        ("data-option-frame", 3, None),
        ("data-option-reaction", 3, None),
        ("data-final-selection", 1, None),
    ),
    "brainstorm-spectrum": (
        ("data-horizon-lane", 3, None),
        ("data-idea-card", 8, None),
        ("data-spectrum-reaction", 1, None),
    ),
    "guided-interview": (
        ("data-interview-step", 4, None),
        ("data-decision-synthesis", 1, None),
    ),
    "semantics-map": (
        ("data-semantics-mapping", 3, None),
        ("data-code-evidence", 2, None),
        ("data-edge-case-table", 1, None),
    ),
    "interactive-prototype": (
        ("data-prototype-variant", 3, None),
        ("data-prototype-control", 3, None),
        ("data-prototype-observation", 1, None),
    ),
    "readiness-check": (
        ("data-readiness-gate", 4, None),
        ("data-readiness-verdict", 1, None),
        ("data-readiness-probe", 1, None),
    ),
    # Stage-4 lifecycle actions. Section-bearing hooks (plan steps, deviations,
    # file cards, kanban cards) are MINIMUMS with no cap; the per-container
    # richness checks (each step carries a question + rank, each deviation the
    # four labelled parts, each file card a risk chip) and the singleton verdict
    # equalities live in the per-action blocks in validate_html.
    "plan-review": (
        ("data-plan-step", 4, None),
        ("data-tweak-rank", 4, None),
        ("data-plan-verdict", 1, None),
    ),
    "build-journal": (
        ("data-deviation", 3, None),
        ("data-deviation-field", 12, None),
        ("data-human-todo", 1, None),
        ("data-journal-verdict", 1, None),
    ),
    "change-walkthrough": (
        ("data-file-card", 3, None),
        ("data-diff-comment", 2, None),
        ("data-deck-slide", 3, None),
        ("data-quiz-question", 2, None),
        ("data-change-verdict", 1, None),
    ),
    # Convention-demonstration boards (CONVENTION_EXAMPLES), not part of the
    # required-11 ACTIONS contract. Minimums per the locked component API.
    "specimen-board": (
        ("data-tradeoffs-honestly", 1, None),
        ("data-fabricated", 1, None),
        ("data-invented-tag", 1, None),
        ("data-annotation-pin", 3, None),
        ("data-browser-frame", 1, None),
        ("data-specimen", 1, None),
        ("data-provenance", 2, None),
    ),
    "board-hub": (
        ("data-board-hub", 1, None),
        ("data-board-index", 1, None),
        ("data-board-link", 2, None),
    ),
    # Architecture/diagram specimen board: a layered blueprint rather than a
    # browser-frame mockup, so it demonstrates the pins + provenance + honest
    # trade-offs conventions over a code-architecture subject WITHOUT requiring
    # data-browser-frame. Structural hooks prove the layered decomposition IA.
    "architecture-board": (
        ("data-arch-layer", 3, None),
        ("data-arch-module", 5, None),
        ("data-tradeoffs-honestly", 1, None),
        ("data-fabricated", 1, None),
        ("data-invented-tag", 1, None),
        ("data-annotation-pin", 4, None),
        ("data-specimen", 1, None),
        ("data-provenance", 2, None),
    ),
    # Fourth convention board: spatial-arrangement-as-decision. At least three
    # lanes holding at least six draggable cards; the per-card lane <select>
    # keyboard fallback is enforced as selects >= cards in the per-action block.
    "triage-board": (
        ("data-kanban-lane", 3, None),
        ("data-kanban-cards", 3, None),
        ("data-drag-item", 6, None),
    ),
}


class ContractParser(HTMLParser):
    VOID_TAGS = {
        "area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr",
    }

    def __init__(self) -> None:
        super().__init__()
        self.page_roots: list[dict[str, str | None]] = []
        self.sections: list[dict[str, str | None]] = []
        self.user_regions: list[tuple[str, dict[str, str | None]]] = []
        self.questions: list[dict[str, str | None]] = []
        self.prompt_hosts = 0
        self.copy_prompt_controls = 0
        self.docnavs = 0
        self.prompt_folds = 0
        self.decision_summary_hosts = 0
        self.note_summary_hosts = 0
        self.search_controls = 0
        self.stylesheets: list[str | None] = []
        self.scripts: list[str | None] = []
        self.presentation_patterns: set[str] = set()
        self.attribute_counts: Counter[str] = Counter()
        self.attribute_value_counts: Counter[tuple[str, str]] = Counter()
        self.ids: Counter[str] = Counter()
        self.option_frames: list[dict[str, object]] = []
        self.final_direction_choices: list[str] = []
        self._active_option_frames: list[dict[str, object]] = []
        # Stage-4 per-container tallies. Each list holds one record per opened
        # container instance; children seen while the container is open are
        # attributed to it (the same idiom as option frames, generalized).
        self.plan_steps: list[dict[str, object]] = []
        self.deviations: list[dict[str, object]] = []
        self.file_cards: list[dict[str, object]] = []
        self.select_controls = 0
        self._active_containers: list[tuple[str, dict[str, object]]] = []
        self._element_stack: list[
            tuple[str, dict[str, object] | None, list[tuple[str, dict[str, object]]]]
        ] = []

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        attributes = dict(attrs)
        self.attribute_counts.update(attributes.keys())
        for attr_name, attr_value in attributes.items():
            if attr_value is not None:
                self.attribute_value_counts[(attr_name, attr_value)] += 1
        opened_frame: dict[str, object] | None = None
        if "data-option-frame" in attributes:
            opened_frame = {
                "scenario_id": attributes.get("data-scenario-id"),
                "direction_id": attributes.get("data-direction-id"),
                "composition": attributes.get("data-direction-composition"),
                "artifacts": 0,
                "traits": set(),
                "reaction_kinds": set(),
                "reaction_groups": 0,
                "tags": Counter(),
            }
            self.option_frames.append(opened_frame)
            self._active_option_frames.append(opened_frame)
        if self._active_option_frames:
            frame = self._active_option_frames[-1]
            frame["tags"][tag] += 1
            if "data-direction-artifact" in attributes:
                frame["artifacts"] += 1
            trait = attributes.get("data-direction-trait")
            if trait:
                frame["traits"].add(trait)
            reaction_kind = attributes.get("data-reaction-kind")
            if reaction_kind:
                frame["reaction_kinds"].add(reaction_kind)
            if "data-option-reaction" in attributes:
                frame["reaction_groups"] += 1
        direction_choice = attributes.get("data-direction-choice")
        if direction_choice:
            self.final_direction_choices.append(direction_choice)
        if tag == "select":
            self.select_controls += 1
        # Attribute children to every currently-open stage-4 container BEFORE
        # opening any container this element itself starts, so a container never
        # counts its own hook as a child of itself.
        for kind, record in self._active_containers:
            if kind == "plan-step":
                if "data-discovery-question" in attributes:
                    record["questions"] += 1
                if "data-tweak-rank" in attributes:
                    record["ranks"] += 1
            elif kind == "deviation":
                field = attributes.get("data-deviation-field")
                if field:
                    record["fields"].add(field)
                if "data-discovery-question" in attributes:
                    record["questions"] += 1
            elif kind == "file-card":
                if "data-risk" in attributes:
                    record["risk_chips"] += 1
        opened_containers: list[tuple[str, dict[str, object]]] = []
        if "data-plan-step" in attributes:
            record = {"questions": 0, "ranks": 0}
            self.plan_steps.append(record)
            opened_containers.append(("plan-step", record))
        if "data-deviation" in attributes:
            record = {"fields": set(), "questions": 0}
            self.deviations.append(record)
            opened_containers.append(("deviation", record))
        if "data-file-card" in attributes:
            record = {"risk_chips": 0}
            self.file_cards.append(record)
            opened_containers.append(("file-card", record))
        self._active_containers.extend(opened_containers)
        if attributes.get("id"):
            self.ids[attributes["id"]] += 1
        if "data-discovery-page" in attributes:
            self.page_roots.append(attributes)
        if "data-discovery-section" in attributes:
            self.sections.append(attributes)
        if tag in {"header", "section"}:
            self.user_regions.append((tag, attributes))
        if "data-discovery-question" in attributes:
            self.questions.append(attributes)
        if "data-discovery-prompt-host" in attributes:
            self.prompt_hosts += 1
        if "data-copy-generated-prompt" in attributes:
            self.copy_prompt_controls += 1
        classes = set((attributes.get("class") or "").split())
        if "essential-docnav" in classes:
            self.docnavs += 1
        if "essential-prompt-fold" in classes:
            self.prompt_folds += 1
        if "data-decision-summaries" in attributes:
            self.decision_summary_hosts += 1
        if "data-note-summaries" in attributes:
            self.note_summary_hosts += 1
        if tag == "input" and attributes.get("type") == "search":
            self.search_controls += 1
        if tag == "link" and attributes.get("rel") == "stylesheet":
            self.stylesheets.append(attributes.get("href"))
        if tag == "script" and attributes.get("src"):
            self.scripts.append(attributes.get("src"))
        self.presentation_patterns.update(
            (attributes.get("data-presentation-pattern") or "").split()
        )
        if tag not in self.VOID_TAGS:
            self._element_stack.append((tag, opened_frame, opened_containers))

    def handle_endtag(self, tag: str) -> None:
        while self._element_stack:
            opened_tag, opened_frame, opened_containers = self._element_stack.pop()
            if opened_frame is not None:
                self._active_option_frames.remove(opened_frame)
            for container in opened_containers:
                self._active_containers.remove(container)
            if opened_tag == tag:
                break

    def handle_startendtag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID_TAGS:
            self.handle_endtag(tag)


def validate_html(path: Path, *, allow_placeholders: bool = False) -> list[str]:
    errors: list[str] = []
    text = path.read_text(encoding="utf-8")
    parser = ContractParser()
    parser.feed(text)
    lowered = text.lower()

    for forbidden in FORBIDDEN_HTML_TEXT:
        if forbidden in lowered:
            errors.append(f"{path}: contains forbidden source framing {forbidden!r}")

    if len(parser.page_roots) != 1:
        errors.append(f"{path}: expected exactly one data-discovery-page root")
    elif not allow_placeholders:
        root = parser.page_roots[0]
        for attr in ("data-page-id", "data-discovery-action", "data-discovery-goal"):
            if not root.get(attr):
                errors.append(f"{path}: page root is missing {attr}")

    if len(parser.sections) != len(parser.user_regions):
        errors.append(f"{path}: every header/section must be annotatable")

    # Section counts are VARIABLE by design: a page carries any number (>= 1) of
    # [data-discovery-section] regions, and ANY section type may repeat (several
    # decision-question sections, several mapping/file/deviation/finding
    # sections). Section ids are free-form, per-instance ids — unique per page,
    # not a fixed slot set. The only per-page singleton is the generated-brief
    # prompt host (enforced separately below via prompt_hosts == 1).
    if not parser.sections:
        errors.append(f"{path}: needs at least one [data-discovery-section] region")

    section_ids = [section.get("data-section-id") for section in parser.sections]
    if any(not section_id for section_id in section_ids):
        errors.append(f"{path}: every annotatable section needs data-section-id")
    if len(section_ids) != len(set(section_ids)):
        errors.append(f"{path}: section IDs must be unique")
    duplicate_ids = sorted(element_id for element_id, count in parser.ids.items() if count > 1)
    if duplicate_ids:
        errors.append(f"{path}: element IDs must be unique; duplicated {duplicate_ids}")

    for question in parser.questions:
        if not question.get("data-question-id"):
            errors.append(f"{path}: question missing data-question-id")
        if not question.get("data-question-label"):
            errors.append(f"{path}: question missing data-question-label")

    if parser.prompt_hosts != 1:
        errors.append(f"{path}: expected exactly one generated prompt host")
    if parser.copy_prompt_controls != 1:
        errors.append(f"{path}: expected exactly one prompt copy control")
    if parser.docnavs != 1:
        errors.append(f"{path}: expected exactly one shared document navigation")
    if parser.prompt_folds != 1:
        errors.append(f"{path}: expected exactly one folded prompt region")
    if parser.decision_summary_hosts != 1:
        errors.append(f"{path}: expected one multi-decision summary host")
    if parser.attribute_counts["data-decision-label"] != 1:
        errors.append(f"{path}: expected one dynamic decision/action label host")
    if parser.note_summary_hosts != 1:
        errors.append(f"{path}: expected one multi-note summary host")
    if parser.search_controls:
        errors.append(f"{path}: static single-page artifact must not include search")
    # Asset self-containment: a composed page or shell carries NO external or
    # relatively linked assets. The build step (scripts/build_artifact.py)
    # injects the Tailwind runtime plus discovery.css/js into the FINAL artifact;
    # sources and shells reference none. Require their ABSENCE — no
    # <link rel="stylesheet">, no <script src>, and no {{DISCOVERY_*_URL}}
    # placeholder (external OR relative refs both caught). The inline
    # <style type="text/tailwindcss"> @theme block below stays required.
    if parser.stylesheets:
        errors.append(
            f"{path}: must not link any stylesheet (assets are inlined by the "
            f"build step); found {parser.stylesheets}"
        )
    if parser.scripts:
        errors.append(
            f"{path}: must not link any external or relative script (assets are "
            f"inlined by the build step); found {parser.scripts}"
        )
    for dead_placeholder in ("{{DISCOVERY_CSS_URL}}", "{{DISCOVERY_JS_URL}}"):
        if dead_placeholder in text:
            errors.append(
                f"{path}: must not contain asset placeholder {dead_placeholder} "
                f"(the build step injects assets directly)"
            )
    for theme_fragment in (
        "@theme inline",
        "--color-canvas: var(--ui-canvas)",
        "--color-glass: var(--ui-glass)",
    ):
        if theme_fragment not in text:
            errors.append(
                f"{path}: missing shared Tailwind theme mapping {theme_fragment!r}"
            )
    if "Copy prompt for LLM coder" not in text:
        errors.append(f"{path}: prompt copy control has the wrong label")
    unknown_patterns = parser.presentation_patterns.difference(PRESENTATION_PATTERNS)
    if unknown_patterns:
        errors.append(
            f"{path}: unknown presentation pattern markers {sorted(unknown_patterns)}"
        )

    if not allow_placeholders and len(parser.page_roots) == 1:
        action = parser.page_roots[0].get("data-discovery-action")
        if action not in ACTION_STRUCTURE:
            errors.append(f"{path}: unknown discovery action {action!r}")
        else:
            for attribute, minimum, maximum in ACTION_STRUCTURE[action]:
                count = parser.attribute_counts[attribute]
                if count < minimum:
                    errors.append(
                        f"{path}: {action} needs at least {minimum} [{attribute}] "
                        f"elements; found {count}"
                    )
                if maximum is not None and count > maximum:
                    errors.append(
                        f"{path}: {action} allows at most {maximum} [{attribute}] "
                        f"elements; found {count}"
                    )
        if action in CONVENTION_EXAMPLES:
            if not parser.page_roots[0].get("data-board-id"):
                errors.append(f"{path}: board root is missing data-board-id")
        if action == "specimen-board":
            for group in ("wins", "costs", "fails-when"):
                if parser.attribute_value_counts[("data-tradeoff-group", group)] < 1:
                    errors.append(
                        f"{path}: specimen-board trade-offs block is missing the "
                        f"required data-tradeoff-group={group!r} group"
                    )
            pin_count = parser.attribute_counts["data-annotation-pin"]
            pin_note_count = parser.attribute_counts["data-pin-note"]
            if pin_count != pin_note_count:
                errors.append(
                    f"{path}: specimen-board data-annotation-pin count "
                    f"({pin_count}) must match data-pin-note count "
                    f"({pin_note_count})"
                )
        if action == "architecture-board":
            for group in ("wins", "costs", "fails-when"):
                if parser.attribute_value_counts[("data-tradeoff-group", group)] < 1:
                    errors.append(
                        f"{path}: architecture-board trade-offs block is missing "
                        f"the required data-tradeoff-group={group!r} group"
                    )
            pin_count = parser.attribute_counts["data-annotation-pin"]
            pin_note_count = parser.attribute_counts["data-pin-note"]
            if pin_count != pin_note_count:
                errors.append(
                    f"{path}: architecture-board data-annotation-pin count "
                    f"({pin_count}) must match data-pin-note count "
                    f"({pin_note_count})"
                )
        if action == "ranked-options":
            if text.count("discovery-review-frame-code") < 1:
                errors.append(
                    f"{path}: ranked options need at least one readable code-surface "
                    "direction frame"
                )
            frames = parser.attribute_counts["data-option-frame"]
            reactions = parser.attribute_counts["data-option-reaction"]
            if reactions < frames:
                errors.append(
                    f"{path}: every ranked option frame needs a local reaction "
                    f"control; found {reactions} reactions for {frames} frames"
                )
            root_scenario = parser.page_roots[0].get("data-scenario-id")
            if not root_scenario:
                errors.append(f"{path}: ranked options need a shared root scenario ID")
            direction_ids = [frame["direction_id"] for frame in parser.option_frames]
            compositions = [frame["composition"] for frame in parser.option_frames]
            if any(not direction_id for direction_id in direction_ids):
                errors.append(f"{path}: every option frame needs data-direction-id")
            if len(direction_ids) != len(set(direction_ids)):
                errors.append(f"{path}: option frame direction IDs must be unique")
            if any(not composition for composition in compositions):
                errors.append(
                    f"{path}: every option frame needs data-direction-composition"
                )
            if len(compositions) != len(set(compositions)):
                errors.append(f"{path}: option frame compositions must be unique")
            for frame in parser.option_frames:
                direction_id = frame["direction_id"] or "<missing>"
                if frame["scenario_id"] != root_scenario:
                    errors.append(
                        f"{path}: option {direction_id!r} must use shared scenario "
                        f"{root_scenario!r}"
                    )
                if frame["artifacts"] != 1:
                    errors.append(
                        f"{path}: option {direction_id!r} needs exactly one "
                        f"data-direction-artifact; found {frame['artifacts']}"
                    )
                if len(frame["traits"]) < 2:
                    errors.append(
                        f"{path}: option {direction_id!r} needs at least two named "
                        f"direction traits; found {len(frame['traits'])}"
                    )
                if frame["reaction_groups"] != 1:
                    errors.append(
                        f"{path}: option {direction_id!r} needs exactly one local "
                        f"reaction group; found {frame['reaction_groups']}"
                    )
                required_reactions = {"keep", "steal", "reject"}
                if frame["reaction_kinds"] != required_reactions:
                    errors.append(
                        f"{path}: option {direction_id!r} reaction kinds must be "
                        f"{sorted(required_reactions)}; found "
                        f"{sorted(frame['reaction_kinds'])}"
                    )
            if Counter(parser.final_direction_choices) != Counter(direction_ids):
                errors.append(
                    f"{path}: final direction choices must map one-to-one to option "
                    f"frame IDs; found {parser.final_direction_choices!r} for "
                    f"{direction_ids!r}"
                )
            signatures = [
                tuple(sorted(frame["tags"].items()))
                for frame in parser.option_frames
            ]
            if len(signatures) != len(set(signatures)):
                errors.append(
                    f"{path}: option frames must use materially distinct structures, "
                    "not renamed copies"
                )
        if action == "plan-review":
            # Every plan step is answerable and ranked; one final hand-off verdict.
            for index, step in enumerate(parser.plan_steps, start=1):
                if step["questions"] < 1:
                    errors.append(
                        f"{path}: plan step {index} needs a decision question "
                        f"(a [data-discovery-question] inside [data-plan-step])"
                    )
                if step["ranks"] < 1:
                    errors.append(
                        f"{path}: plan step {index} needs a [data-tweak-rank] "
                        "affordance"
                    )
            verdicts = parser.attribute_counts["data-plan-verdict"]
            if verdicts != 1:
                errors.append(
                    f"{path}: plan-review needs exactly one [data-plan-verdict]; "
                    f"found {verdicts}"
                )
        if action == "build-journal":
            required_fields = {
                "plan-said",
                "code-revealed",
                "choice-taken",
                "revisit",
            }
            for index, deviation in enumerate(parser.deviations, start=1):
                missing = required_fields.difference(deviation["fields"])
                if missing:
                    errors.append(
                        f"{path}: deviation {index} is missing labelled "
                        f"[data-deviation-field] part(s) {sorted(missing)}"
                    )
                if deviation["questions"] < 1:
                    errors.append(
                        f"{path}: deviation {index} needs a revisit question "
                        "(a [data-discovery-question] inside [data-deviation])"
                    )
            verdicts = parser.attribute_counts["data-journal-verdict"]
            if verdicts != 1:
                errors.append(
                    f"{path}: build-journal needs exactly one "
                    f"[data-journal-verdict]; found {verdicts}"
                )
        if action == "change-walkthrough":
            for index, card in enumerate(parser.file_cards, start=1):
                if card["risk_chips"] < 1:
                    errors.append(
                        f"{path}: file card {index} needs a risk chip "
                        "([data-risk] inside [data-file-card])"
                    )
            verdicts = parser.attribute_counts["data-change-verdict"]
            if verdicts != 1:
                errors.append(
                    f"{path}: change-walkthrough needs exactly one final "
                    f"[data-change-verdict]; found {verdicts}"
                )
        if action == "triage-board":
            # Keyboard fallback: every draggable card carries a lane <select>, so
            # the board is operable without a pointer. One select per card is the
            # cheap proxy for that per-card fallback.
            cards = parser.attribute_counts["data-drag-item"]
            if parser.select_controls < cards:
                errors.append(
                    f"{path}: triage-board needs a per-card lane <select> keyboard "
                    f"fallback; found {parser.select_controls} selects for {cards} "
                    "cards"
                )

    errors.extend(_validate_stage3_structure(path, parser))
    return errors


def _validate_stage3_structure(path: Path, parser: ContractParser) -> list[str]:
    """Cheap structural checks for the stage-3 catalog patterns.

    Each check is presence-gated on its own marker, so a board (or the
    placeholder template) that does not demonstrate the pattern is unaffected.
    These prove the load-bearing pairing/count invariants of the interactive
    patterns; they are not a substitute for rendered review.
    """

    errors: list[str] = []
    counts = parser.attribute_counts

    # code-tabs: one panel per tab, so every representation is reachable.
    if counts["data-code-tabs"] or counts["data-code-tab"] or counts["data-code-panel"]:
        tabs = counts["data-code-tab"]
        panels = counts["data-code-panel"]
        if tabs != panels:
            errors.append(
                f"{path}: code-tabs must have one [data-code-panel] per "
                f"[data-code-tab]; found {tabs} tabs, {panels} panels"
            )

    # spectrum-minimap: one dot per idea card, so the minimap mirrors the axis.
    if counts["data-minimap-dot"]:
        dots = counts["data-minimap-dot"]
        cards = counts["data-idea-card"]
        if dots != cards:
            errors.append(
                f"{path}: spectrum-minimap must have one [data-minimap-dot] per "
                f"[data-idea-card]; found {dots} dots, {cards} cards"
            )

    # drag-probe: needs at least three draggable items to feel like an ordering.
    if counts["data-drag-probe"] or counts["data-drag-item"]:
        items = counts["data-drag-item"]
        if items < 3:
            errors.append(
                f"{path}: drag-probe needs at least 3 [data-drag-item] elements; "
                f"found {items}"
            )

    # Synchronized-highlight idioms: every keyed group needs at least two
    # members (a source and its counterpart) or there is nothing to sync. Each
    # idiom's key is carried across its source + target attributes.
    sync_idioms = {
        "data-code-pair": ("data-code-pair",),
        "data-term": ("data-term", "data-term-def"),
        "data-code-map": ("data-code-map", "data-code-map-target"),
    }
    for idiom, attrs in sync_idioms.items():
        if not any(counts[attr] for attr in attrs):
            continue
        members: Counter[str] = Counter()
        for (attr, value), count in parser.attribute_value_counts.items():
            if attr in attrs:
                members[value] += count
        for value, count in sorted(members.items()):
            if count < 2:
                errors.append(
                    f"{path}: {idiom}={value!r} needs at least 2 members "
                    f"(source + counterpart); found {count}"
                )

    # wizard-steps: a wizard must present at least three ordered steps.
    if counts["data-wizard"]:
        steps = counts["data-interview-step"]
        if steps < 3:
            errors.append(
                f"{path}: wizard needs at least 3 [data-interview-step] steps; "
                f"found {steps}"
            )

    # theme-direction-gallery: at least two competing specimen scopes side by side.
    if "theme-direction-gallery" in parser.presentation_patterns:
        specimens = counts["data-specimen"]
        if specimens < 2:
            errors.append(
                f"{path}: theme-direction-gallery needs at least 2 [data-specimen] "
                f"scopes; found {specimens}"
            )

    return errors


def presentation_patterns(path: Path) -> set[str]:
    parser = ContractParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser.presentation_patterns


def validate_runtime(skipped: list[str]) -> list[str]:
    errors: list[str] = []
    source = JAVASCRIPT.read_text(encoding="utf-8")
    required_fragments = (
        "essential.discover.v1:",
        "data-discovery-section",
        "data-discovery-prompt-host",
        "data-copy-generated-prompt",
        "navigator.clipboard.writeText",
        "localStorage",
        "touched",
        "annotations",
        "data-decision-summaries",
        "data-note-summaries",
        "dataset.responseKind",
        "Requested follow-up actions",
        "item.dataset.summaryState",
        "promptFoldTarget.append(promptSection)",
        # "Best bits" fold-in: generated-prompt sections for provenance and
        # trade-offs, plus the pin-linking hook. Only "data-annotation-pin" is
        # required here (not "data-pin-note"): the pin<->note association is
        # spec'd via aria-describedby/id lookup, not a dataset scan, so the
        # note-side literal is not guaranteed to appear in the JS source even
        # in a correct implementation.
        "Provenance of claims",
        "Trade-offs surfaced",
        "data-annotation-pin",
        # Board set: the docnav index is built by the runtime, which owns
        # aria-current and the hide-below-two-entries rule, so an author never
        # hand-marks "you are here".
        "data-board-set",
        "data-board-link",
        'setAttribute("aria-current", "page")',
        # Selection-scoped annotation: a second, quote-carrying note store
        # beside the per-section one, armed from a live selection.
        "excerpts",
        "getSelection",
        "selectionArmed",
        "data-annotation-quote",
        # Mermaid: rendered through DOMParser (never innerHTML) and themed from
        # the live --ui-* tokens rather than any named color.
        "data-mermaid-source",
        "data-mermaid-host",
        "DOMParser",
        "MERMAID_THEME_TOKENS",
    )
    for fragment in required_fragments:
        if fragment not in source:
            errors.append(f"{JAVASCRIPT}: missing runtime behavior {fragment!r}")
    if ".innerHTML" in source:
        errors.append(f"{JAVASCRIPT}: user-facing runtime must not use innerHTML")

    # Node is not one of the repository's declared prerequisites (Bash, jq, Git,
    # uv, gh), and this validator now runs inside `uvx pytest`, so an absent
    # `node` must not make the one-command validation unrunnable. The skip is
    # reported rather than swallowed: CI has Node, so the check still gates.
    try:
        result = subprocess.run(
            ["node", "--check", str(JAVASCRIPT)],
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        skipped.append(f"{JAVASCRIPT}: JavaScript syntax check (node not installed)")
    else:
        if result.returncode != 0:
            errors.append(
                f"{JAVASCRIPT}: JavaScript syntax check failed: {result.stderr.strip()}"
            )
    return errors


def validate_stylesheet() -> list[str]:
    errors: list[str] = []
    source = CSS.read_text(encoding="utf-8")
    required_fragments = (
        "container-name: direction-artifact",
        "container-type: inline-size",
        ".discovery-direction-stats",
        ".discovery-direction-flow",
        ".discovery-direction-columns-main-aside",
        "@container direction-artifact (min-width: 44rem)",
        "@media (min-width: 82.01rem)",
        "mask-image: linear-gradient",
        ".discovery-review-frame-code",
        "width: 18.6rem",
        # "Best bits" fold-in: provenance pills, honest trade-offs/invented-data
        # flag, annotation pins, board-index, specimen brand-palette scoping.
        ".discovery-provenance",
        "[data-provenance",
        ".discovery-tradeoffs",
        ".discovery-invented-tag",
        ".discovery-pin",
        ".discovery-pin-layer",
        ".discovery-pin-note",
        ".discovery-board-index",
        "[data-specimen]",
        ".discovery-artifact-url",
        # Docnav board set, selection annotation, content-kind column density,
        # and the Mermaid figure — the density scale is asserted by name so no
        # board re-introduces a bare column number.
        ".essential-board-set",
        # The board set authors its own `display`, which beats the user agent's
        # rule for [hidden]; without this restatement the hide-below-two
        # contract holds only while the runtime runs.
        ".essential-board-set[hidden]",
        ".essential-board-link",
        ".discovery-selection-pill",
        ".discovery-annotation-quote",
        ".discovery-excerpt",
        "--grid-col-tile",
        "--grid-col-compact",
        "--grid-col-prose",
        "--grid-col-wide",
        '[data-grid-density="prose"]',
        ".discovery-mermaid",
    )
    for fragment in required_fragments:
        if fragment not in source:
            errors.append(f"{CSS}: missing responsive direction layout {fragment!r}")
    return errors


def validate_scaffold() -> list[str]:
    """The starter scaffold must ship the shell blocks, not describe them.

    A Floor feature an author has to remember to add is not a floor. The docnav
    board-set block and the selection-note hint therefore live in the scaffold
    itself; the runtime hides the block below two entries, so shipping it costs
    a single-artifact board nothing.
    """
    errors: list[str] = []
    source = TEMPLATE.read_text(encoding="utf-8")
    required_fragments = (
        "data-board-set-rule",
        "data-board-set-heading",
        "data-board-set",
        "essential-board-set",
        "essential-board-link",
        "select text inside one",
    )
    for fragment in required_fragments:
        if fragment not in source:
            errors.append(f"{TEMPLATE}: starter scaffold is missing {fragment!r}")
    if "aria-current=" in source:
        errors.append(
            f"{TEMPLATE}: scaffold must not hand-set aria-current — the runtime "
            "marks the entry matching this board's id"
        )
    return errors


def validate_direction_reference_contract() -> list[str]:
    errors: list[str] = []
    required_fragments = {
        COMPONENTS_REFERENCE: (
            "## Direction frame and trait reactions",
            "data-scenario-id",
            "data-direction-artifact",
            "data-direction-trait",
            'data-reaction-kind="keep"',
            'data-reaction-kind="steal"',
            'data-reaction-kind="reject"',
            "data-direction-choice",
        ),
        RANKED_REFERENCE: (
            "## Direction-decision acceptance",
            "### Visual-direction worked mapping",
            "shared scenario ID",
            "keep/steal/reject",
            "one-to-one",
            "`web:design`",
        ),
    }
    for path, fragments in required_fragments.items():
        if not path.is_file():
            errors.append(f"{path}: direction reference is missing")
            continue
        source = path.read_text(encoding="utf-8")
        for fragment in fragments:
            if fragment not in source:
                errors.append(
                    f"{path}: missing direction contract guidance {fragment!r}"
                )
    return errors


_BUILD_ARTIFACT = None


def _load_builder() -> ModuleType:
    """Import build_artifact by path, caching the module.

    The scripts directory is a plain directory (not a package), so the module is
    loaded via sys.path in the same style validate_artifact_builder already uses.
    """

    global _BUILD_ARTIFACT
    if _BUILD_ARTIFACT is not None:
        return _BUILD_ARTIFACT
    sys.path.insert(0, str(BUILDER.parent))
    sys.dont_write_bytecode = True  # keep scripts/__pycache__ out of the tree
    import build_artifact  # noqa: PLC0415 — local script import by design

    _BUILD_ARTIFACT = build_artifact
    return build_artifact


class _BoardLinkFinder(HTMLParser):
    """Collect every board link: its id, its href, and whether a hub index holds it.

    The quoting is left to the parser because a quote style is a formatting
    choice, and this feeds a gate whose own coverage would otherwise depend on
    it. The hub's index is tracked by nesting so its list can be compared against
    the roster on its own — the shared sidebar partial names every board too, so
    a check that merely looked for the ids somewhere in the composed page would
    agree with itself no matter what the hub said.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._stack: list[str] = []
        self._index_depths: list[int] = []
        self.links: list[dict[str, object]] = []
        # Recorded on sight and never unset: an index that closes empty still
        # existed, and that is the case the comparison must not skip.
        self.saw_index = False

    def _record(self, attrs: list[tuple[str, str | None]]) -> None:
        values = {name: (value or "").strip() for name, value in attrs}
        if not values.get("data-board-link"):
            return
        self.links.append(
            {
                "id": values["data-board-link"],
                "href": values.get("href", ""),
                "in_index": bool(self._index_depths),
            }
        )

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        names = {name for name, _ in attrs}
        if "data-board-index" in names:
            self.saw_index = True
        # The builder owns the void-element list; reading it here keeps the two
        # parsers agreeing about what opens a scope.
        if tag not in _load_builder().VOID_TAGS:
            self._stack.append(tag)
            if "data-board-index" in names:
                self._index_depths.append(len(self._stack))
        self._record(attrs)

    def handle_startendtag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        self._record(attrs)

    def handle_endtag(self, tag: str) -> None:
        if tag not in self._stack:
            return
        while self._stack:
            closed = self._stack.pop()
            while self._index_depths and self._index_depths[-1] > len(self._stack):
                self._index_depths.pop()
            if closed == tag:
                return


def _board_links(html: str) -> list[dict[str, object]]:
    finder = _BoardLinkFinder()
    finder.feed(html)
    finder.close()
    return finder.links


def _has_board_index(html: str) -> bool:
    finder = _BoardLinkFinder()
    finder.feed(html)
    finder.close()
    return finder.saw_index


def validate_board_set_single_home() -> list[str]:
    """The example run's board set must exist once, not once per sibling board.

    Every board of one run carries the same list of boards, so hand-authoring it
    into each page.html makes N sources of truth for one fact and the copies
    drift the moment a board is added or renamed. Each page names the shared
    partial through an include and the composer rewrites the list from it; a
    board entry authored directly into a page is the regression this catches.
    """

    shared = EXAMPLES_SRC_ROOT / "_shared" / "board-set.html"
    if not shared.is_file():
        return [f"{shared}: shared board-set partial is missing"]

    # This gate decides which pages get checked, so anything it fails to see is a
    # board that silently leaves the invariant. A quote style is a formatting
    # choice no author would expect to change coverage, so the attribute is read
    # by the HTML parser rather than matched on one spelling of it.

    errors: list[str] = []
    include_line = "<!-- {{INCLUDE: _shared/board-set.html}} -->"
    roster = _board_links(shared.read_text(encoding="utf-8"))
    if not roster:
        errors.append(f"{shared}: shared board-set partial names no boards")
    hrefs = {str(entry["id"]): str(entry["href"]) for entry in roster}

    # The invariant is the identical index on EVERY board of the run, so the
    # partial's own entries decide which pages are checked. Keying off the pages
    # that happen to still carry the block would let a board drop the index
    # entirely and stay green.
    for board in hrefs:
        page = EXAMPLES_SRC_ROOT / board / "page.html"
        if not page.is_file():
            errors.append(
                f"{shared}: names board {board!r}, which has no source at {page}"
            )
            continue
        text = page.read_text(encoding="utf-8")
        if include_line not in text:
            errors.append(
                f"{page}: board is named in {shared} but does not include it; "
                f"every board of a run carries the same index — add "
                f"'{include_line}'"
            )
        if "data-board-link" in text:
            errors.append(
                f"{page}: board-set entries are authored into the page; they "
                f"belong once in {shared} — replace them with "
                f"'{include_line}'"
            )

    # A page.html read alone cannot see a second roster: sections/ compose into
    # the page, and the hub's own board index lives there, repeating every id and
    # href. So every board's COMPOSED source is inspected, and each link it
    # carries is checked against the partial. The partial stays the one home for
    # which boards exist and where each one lives; a hub index that names an
    # unknown board, points somewhere else, or misses one now fails here.
    builder = _load_builder()
    for source_dir in sorted(EXAMPLES_SRC_ROOT.glob("*/")):
        if source_dir.name.startswith("_"):
            continue
        try:
            composed = builder.compose_directory(source_dir)
        except builder.BuildError as error:
            errors.append(f"{source_dir}: cannot compose to check board links: {error}")
            continue
        links = _board_links(composed)
        for link in links:
            board_id = str(link["id"])
            if board_id not in hrefs:
                errors.append(
                    f"{source_dir}: links to board {board_id!r}, which {shared} "
                    "does not name; the shared partial is the only roster"
                )
            elif link["href"] and link["href"] != hrefs[board_id]:
                errors.append(
                    f"{source_dir}: links to board {board_id!r} at "
                    f"{link['href']!r}, but {shared} places it at "
                    f"{hrefs[board_id]!r}"
                )
        # Whether the board HAS an index is asked separately from what that index
        # holds. Deriving the first from the second excuses the emptiest
        # projection of all: a hub whose index lost every entry has none left to
        # compare, while the shared sidebar in the same composed page keeps the
        # rest of this gate satisfied.
        if _has_board_index(composed):
            indexed = {str(link["id"]) for link in links if link["in_index"]}
            if indexed != set(hrefs):
                missing = sorted(set(hrefs) - indexed)
                errors.append(
                    f"{source_dir}: its [data-board-index] is a projection of "
                    f"{shared} and must list every board; missing {missing}"
                )
    return errors


def validate_source_drift(page_path: Path, source_dir: Path) -> list[str]:
    """Require a committed page to be byte-identical to its composed source.

    Every committed single-file board page must be authored as a modular source
    directory (examples/src/<name>/ or templates/src/page/) whose composition
    reproduces the page byte-for-byte. This forbids giant-file-only boards from
    being added going forward, and catches a committed page that has drifted out
    of lockstep with its modular sources.
    """

    if not source_dir.is_dir():
        return [
            f"{page_path}: committed page has no modular source directory "
            f"(expected {source_dir}); every board must be authored as modular "
            f"sources — add {source_dir}/page.html + sections/*.html and run "
            f"'build_artifact.py {source_dir} --emit-page'"
        ]
    try:
        build_artifact = _load_builder()
        composed = build_artifact.compose_directory(source_dir)
    except Exception as error:  # pragma: no cover - compose/import failure is the finding
        return [
            f"{source_dir}: could not compose modular source for {page_path}: "
            f"{error!r}"
        ]
    if composed.encode("utf-8") != page_path.read_bytes():
        return [
            f"{page_path}: committed page has drifted from its modular source "
            f"{source_dir}; edit the sources and run "
            f"'build_artifact.py {source_dir} --emit-page' to regenerate it"
        ]
    return []


def validate_artifact_builder() -> list[str]:
    """Verify build_artifact.py emits genuinely self-contained output.

    Guards the publish pipeline: a compiled board must inline the Tailwind
    runtime plus discovery.css/js with zero external hosts, zero unfilled
    template placeholders, and zero raw U+FFFD byte (the sentinel the Artifact
    deploy validator rejects). Both output modes are checked; the compiled blob
    is never read into the test's own reporting — only asserted against.
    """

    errors: list[str] = []
    if not BUILDER.is_file():
        errors.append(f"{BUILDER}: required builder artifact is missing")

    # The version-pinned vendor file must no longer be committed \u2014 the runtime is
    # downloaded on demand now.
    for pinned in sorted(VENDOR_DIR.glob("tailwind-browser-*.js")):
        errors.append(
            f"{pinned}: committed pinned Tailwind vendor file must be removed "
            "(the runtime is downloaded on demand)"
        )
    # The gitignored cache is optional (a missing cache is fine); if present it
    # must itself carry no raw U+FFFD (patched at download time).
    if TAILWIND_CACHE.is_file() and TAILWIND_CACHE.read_bytes().count(
        "\ufffd".encode("utf-8")
    ):
        errors.append(f"{TAILWIND_CACHE}: contains raw U+FFFD (deploy would 400)")

    if errors:
        return errors

    try:
        build_artifact = _load_builder()
    except Exception as error:  # pragma: no cover - import failure is the finding
        return errors + [f"build_artifact import failed: {error!r}"]

    source = EXAMPLES_ROOT / "specimen-board.html"
    if not source.is_file():
        return errors + [f"{source}: builder test source is missing"]

    # The conditional-inlining contract needs both halves compiled to mean
    # anything: a diagram-bearing board that really carries the runtime, and a
    # diagram-free one that really does not. Asserting only the second is how a
    # broken fetch, a failed bundle check, or an over-broad marker regex stays
    # green while every diagram on every board silently fails to draw.
    diagram_source = EXAMPLES_ROOT / "architecture-board.html"
    if not diagram_source.is_file():
        errors.append(f"{diagram_source}: Mermaid builder test source is missing")
    bundle_marker = build_artifact.MERMAID_BUNDLE_SIGNATURE

    # Independently defined (not imported from the builder) so a loosened builder
    # regex cannot blind this gate: Discover placeholders are {{UPPER_SNAKE}}.
    placeholder = re.compile(r"\{\{[A-Z_][A-Z0-9_]*\}\}")
    for mode, artifact in (("full", False), ("fragment", True)):
        try:
            output = build_artifact.build(source, artifact=artifact)
        except Exception as error:  # build's own validation raises on failure
            errors.append(f"builder {mode} mode failed: {error}")
            continue
        raw_bytes = output.encode("utf-8")
        if b'src="http' in raw_bytes:
            errors.append(f"builder {mode}: external src=http host present")
        if b'href="http' in raw_bytes:
            errors.append(f"builder {mode}: external href=http host present")
        if raw_bytes.count("\ufffd".encode("utf-8")):
            errors.append(f"builder {mode}: raw U+FFFD present (deploy would 400)")
        if placeholder.search(output):
            errors.append(f"builder {mode}: unfilled template placeholder present")
        if "@tailwindcss/browser" not in output:
            errors.append(f"builder {mode}: Tailwind runtime not inlined")
        if "--ui-canvas" not in output:
            errors.append(f"builder {mode}: discovery.css not inlined")
        if "[data-discovery-prompt-host]" not in output:
            errors.append(f"builder {mode}: discovery.js not inlined")
        if "data-discovery-prompt-host" not in output:
            errors.append(f"builder {mode}: board markup missing")
        if artifact:
            lowered = output.lower()
            if "<!doctype" in lowered or "<html" in lowered or "<body" in lowered:
                errors.append("builder fragment: must omit doctype/html/body")
        if bundle_marker in output:
            errors.append(
                f"builder {mode}: Mermaid runtime inlined into a board with no "
                "diagram (3.4 MB the board never uses)"
            )

    if diagram_source.is_file():
        for mode, artifact in (("full", False), ("fragment", True)):
            try:
                output = build_artifact.build(diagram_source, artifact=artifact)
            except Exception as error:
                errors.append(f"builder mermaid {mode} mode failed: {error}")
                continue
            if bundle_marker not in output:
                errors.append(
                    f"builder mermaid {mode}: board carries a [data-mermaid] "
                    "figure but no Mermaid runtime was inlined"
                )
            if b'src="http' in output.encode("utf-8"):
                errors.append(f"builder mermaid {mode}: external src=http host")
            if output.encode("utf-8").count("\ufffd".encode("utf-8")):
                errors.append(f"builder mermaid {mode}: raw U+FFFD present")

    # Whether a board pays 3.4 MB is decided by whether it carries the attribute
    # on an element \u2014 not by whether the page mentions it. Prose describing the
    # device, an escaped markup sample, a selector string in an inline script,
    # an authoring comment, and the sibling attributes that hold the definition
    # and the render host are all text; only a real start tag counts.
    marker_cases = (
        ("prose", "<p>the figure carries data-mermaid (the marker)</p>", False),
        ("escaped sample", "<pre>&lt;figure data-mermaid&gt;</pre>", False),
        ("script selector", '<script>q("[data-mermaid]");</script>', False),
        ("comment", "<!-- add data-mermaid to the figure -->", False),
        ("sibling attributes", "<pre data-mermaid-source>graph LR</pre>", False),
        ("figure", "<figure data-mermaid></figure>", True),
        ("uppercase figure", "<FIGURE DATA-MERMAID></FIGURE>", True),
        ("self-closing figure", "<figure data-mermaid />", True),
    )
    for label, fragment, expected in marker_cases:
        if build_artifact.has_mermaid_figure(fragment) is not expected:
            errors.append(
                f"builder mermaid detection: {label} should "
                f"{'require' if expected else 'not require'} the runtime"
            )

    # Detecting the figure is only half of it. A figure the runtime cannot draw
    # — missing either child, or holding a source with no definition in it —
    # ships the whole 3.4 MB runtime for an empty frame, so the parser has to
    # report completeness per figure, counting only what is really nested inside.
    source = f"<pre {build_artifact.MERMAID_SOURCE_ATTR}>graph LR</pre>"
    host = f"<div {build_artifact.MERMAID_HOST_ATTR}></div>"
    figure_cases = (
        ("complete", f"<figure data-mermaid>{source}{host}</figure>", 1, 0, 0),
        ("missing host", f"<figure data-mermaid>{source}</figure>", 1, 1, 0),
        ("missing source", f"<figure data-mermaid>{host}</figure>", 1, 1, 0),
        (
            "children outside the figure",
            f"<figure data-mermaid></figure>{source}{host}",
            1,
            1,
            0,
        ),
        (
            "void element inside",
            f"<figure data-mermaid><img src=x>{source}{host}</figure>",
            1,
            0,
            0,
        ),
        ("self-closing figure", "<figure data-mermaid />", 1, 1, 0),
        (
            "two complete figures",
            f"<figure data-mermaid>{source}{host}</figure>"
            f"<figure data-mermaid>{source}{host}</figure>",
            2,
            0,
            0,
        ),
        ("prose only", "<p>data-mermaid</p>", 0, 0, 0),
        (
            "blank source",
            f'<figure data-mermaid><pre {build_artifact.MERMAID_SOURCE_ATTR}>'
            f"  \n </pre>{host}</figure>",
            1,
            0,
            1,
        ),
        (
            "source text outside the figure",
            f"<figure data-mermaid><pre {build_artifact.MERMAID_SOURCE_ATTR}>"
            f"</pre>{host}</figure>graph LR",
            1,
            0,
            1,
        ),
        # querySelector takes the first source and ignores the rest, so a second
        # one makes the built definition and the rendered one different texts.
        (
            "two sources, first blank",
            f'<figure data-mermaid><pre {build_artifact.MERMAID_SOURCE_ATTR}> '
            f"</pre>{source}{host}</figure>",
            1,
            1,
            0,
        ),
        (
            "two hosts",
            f"<figure data-mermaid>{source}{host}{host}</figure>",
            1,
            1,
            0,
        ),
        # A void source holds no text, so the browser reads nothing from it. The
        # sibling text after it must not be mistaken for the definition.
        (
            "void source element",
            f"<figure data-mermaid><img {build_artifact.MERMAID_SOURCE_ATTR}>"
            f"graph LR; A--&gt;B{host}</figure>",
            1,
            0,
            1,
        ),
    )
    for label, fragment, total, malformed, blank in figure_cases:
        found = build_artifact._mermaid_figures(fragment)
        counted = (
            len(found),
            sum(1 for figure in found if figure.malformed),
            sum(1 for figure in found if figure.blank),
        )
        if counted != (total, malformed, blank):
            errors.append(
                f"builder mermaid figures: {label} parsed as "
                f"{counted}, expected {(total, malformed, blank)} "
                "(figures, malformed, blank)"
            )

    # Self-containment survives only if it is judged on what Mermaid will emit —
    # and only on that. A label is text the browser draws, not a resource it
    # fetches, so a URL or the characters "img:" inside one must still compile.
    external_cases = (
        ("plain flowchart", "graph LR; A-->B", False),
        ("sequence with a colon", "sequenceDiagram; A->>B: hello", False),
        ("comment mentioning a shape", "%% shapes: rounded\ngraph LR; A-->B", False),
        ("url shown in a label", 'A["POST https://api.example/v1"]', False),
        ("img: written in a label", 'A["img: field absent"]', False),
        ("word click in a label", 'A["click href to open"]', False),
        ("image shape", 'A@{ img: "https://example.com/x.png" }', True),
        ("relative image shape", 'A@{ img: "./x.png" }', True),
        ("multiline shape block", 'A@{\n  shape: rect\n  img: "x.png"\n}', True),
        ("click href", 'click A href "https://example.com"', True),
        ("indented click href", '  click A href "//cdn.example.com/x"', True),
    )
    for label, definition, expected in external_cases:
        refused = any(
            pattern.search(definition)
            for _name, pattern in build_artifact.MERMAID_EXTERNAL_PATTERNS
        )
        if refused is not expected:
            errors.append(
                f"builder mermaid externals: {label} should "
                f"{'be refused' if expected else 'be accepted'}"
            )

    # The one-home gate decides its own coverage from these values, so a quote
    # style that the reader cannot see must not remove a board from it.
    link_markup = (
        '<a data-board-link="alpha" href="./a.html"></a>'
        "<a data-board-link='beta' href='./b.html'></a>"
        "<ul data-board-index><li><a data-board-link=gamma href=./c.html>g</a></li></ul>"
        '<a data-board-link="delta" href="./d.html"></a>'
    )
    parsed = [
        (link["id"], link["href"], link["in_index"])
        for link in _board_links(link_markup)
    ]
    expected_links = [
        ("alpha", "./a.html", False),
        ("beta", "./b.html", False),
        # Inside the index, and only until the list closes — the sidebar links
        # that follow must not inherit its scope.
        ("gamma", "./c.html", True),
        ("delta", "./d.html", False),
    ]
    if parsed != expected_links:
        errors.append(
            "board-set link parsing: quote style and index nesting must not "
            f"change what is seen, got {parsed}"
        )
    # An index that closed empty is the case the projection comparison must not
    # skip, so its presence is detected apart from its contents.
    for label, markup, expected in (
        ("populated index", link_markup, True),
        ("empty index", "<ul data-board-index></ul>", True),
        ("no index at all", '<a data-board-link="alpha"></a>', False),
    ):
        if _has_board_index(markup) is not expected:
            errors.append(
                f"board-index detection: {label} should read as "
                f"{'present' if expected else 'absent'}"
            )
    return errors


def run(stage: str, include_builder: bool = True) -> dict[str, object]:
    errors: list[str] = []
    # Checks that could not run for want of an undeclared optional tool. They are
    # never silently dropped: the report names each one.
    skipped: list[str] = []
    expected_actions = (
        (REPRESENTATIVE_ACTION,) if stage == "representative" else ACTIONS
    )
    covered_patterns: set[str] = set()

    for required in (TEMPLATE, CSS, JAVASCRIPT, COVERAGE_REFERENCE):
        if not required.is_file():
            errors.append(f"{required}: required shared artifact is missing")

    if TEMPLATE.is_file():
        errors.extend(validate_html(TEMPLATE, allow_placeholders=True))
        errors.extend(validate_source_drift(TEMPLATE, TEMPLATE_SRC))
        errors.extend(validate_scaffold())
    errors.extend(validate_board_set_single_home())
    if JAVASCRIPT.is_file():
        errors.extend(validate_runtime(skipped))
    if CSS.is_file():
        errors.extend(validate_stylesheet())

    for action in expected_actions:
        example = EXAMPLES_ROOT / f"{action}.html"
        reference = ACTION_ROOT / f"{action}.md"
        if not example.is_file():
            errors.append(f"{example}: required {stage} example is missing")
        else:
            errors.extend(validate_html(example))
            errors.extend(validate_source_drift(example, EXAMPLES_SRC_ROOT / action))
            covered_patterns.update(presentation_patterns(example))
        if not reference.is_file():
            errors.append(f"{reference}: required {stage} action reference is missing")

    # Convention-demonstration boards (specimen-board, board-hub) are validated
    # and pattern-scanned at --stage complete only, separate from the required-11
    # ACTIONS above, so their coverage does not leak into --stage representative.
    convention_examples = CONVENTION_EXAMPLES if stage == "complete" else ()
    for action in convention_examples:
        example = EXAMPLES_ROOT / f"{action}.html"
        if not example.is_file():
            errors.append(f"{example}: required convention example is missing")
        else:
            errors.extend(validate_html(example))
            errors.extend(validate_source_drift(example, EXAMPLES_SRC_ROOT / action))
            covered_patterns.update(presentation_patterns(example))

    if stage == "complete":
        errors.extend(validate_direction_reference_contract())
        # The only check here that needs a network: it compiles boards, and
        # compiling downloads the runtimes. Every other check reads the tree, so
        # an offline caller drops this one alone rather than the whole gate.
        if include_builder:
            errors.extend(validate_artifact_builder())
        missing_patterns = set(PRESENTATION_PATTERNS).difference(covered_patterns)
        if missing_patterns:
            errors.append(
                "examples do not cover every presentation pattern: "
                + ", ".join(sorted(missing_patterns))
            )
    present_examples = sorted(path.stem for path in EXAMPLES_ROOT.glob("*.html"))
    return {
        "status": "pass" if not errors else "fail",
        "stage": stage,
        "examples_present": present_examples,
        "examples_required": list(expected_actions) + list(convention_examples),
        "presentation_patterns_covered": len(covered_patterns),
        "presentation_patterns_required": len(PRESENTATION_PATTERNS),
        "errors": errors,
        "skipped_checks": skipped,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--stage",
        choices=("representative", "complete"),
        default="complete",
        help="Validate the approval-gate artifact or the final eleven-action library.",
    )
    args = parser.parse_args()
    result = run(args.stage)
    print(json.dumps(result, indent=2))
    return 0 if result["status"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())
