"""Scan a rendered pull-request message against its selected template."""

import argparse
import fnmatch
import json
import re
import sys
from dataclasses import asdict, dataclass
from itertools import product
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_TEMPLATE = SCRIPT_DIR.parent / "templates" / "message.md"
SIZE_POLICY = SCRIPT_DIR.parent / "assets" / "size-thresholds.json"
ARCHETYPES = (
    "rfc",
    "code-spec",
    "contract",
    "domain-model",
    "implementation",
    "integration",
    "feature-flag",
    "migration",
    "ui",
    "mechanical-refactor",
    "cleanup",
    "observability",
)
COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
PLACEHOLDER = re.compile(r"\{\{[^{}]+\}\}")
FULL_OID = re.compile(r"[0-9a-f]{40}")
HEADING = re.compile(r"^ {0,3}(## .+?)\s*$")
CHECKBOX = re.compile(r"(?m)^\s*[-*]\s+\[[ xX]\]\s+\S")
LIST_MARKER = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+")
KEYCAP_EMOJI = re.compile(r"^[#*0-9]\ufe0f?\u20e3$")
REVIEWER_ASSIGNED = re.compile(
    r"(?m)^\s*[-*]\s+\[(?P<checked>[ xX])\]\s+Reviewer "
    r"(?P<reviewer>slot [1-9]\d*|@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?) "
    r"assigned\s*$"
)
REVIEWER_EVIDENCE = re.compile(
    r"(?m)^\s*[-*]\s+\[(?P<checked>[ xX])\]\s+Reviewer "
    r"(?P<reviewer>slot [1-9]\d*|@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?) "
    r"(?P<action>reviewed|approved) `(?P<head>[0-9a-f]{40})` "
    r"against `(?P<base>[0-9a-f]{40})`\s*$"
)
CODE_SPAN = re.compile(r"`([^`]+)`")
GENERIC = {
    "n/a",
    "na",
    "none",
    "not applicable",
    "placeholder",
    "tbd",
    "todo",
}
PROCESS_CLAUSE_SEPARATOR = re.compile(
    r"\s*(?:[,;]|\b(?:and|or|then)\b)\s*", re.IGNORECASE
)
PROCESS_QUALIFIER_WORD = r"(?!(?:and|or)\b)[a-z0-9-]+"
PROCESS_QUALIFIERS = (
    rf"(?:(?:{PROCESS_QUALIFIER_WORD}\s+and\s+)*{PROCESS_QUALIFIER_WORD}"
    rf"(?:\s+{PROCESS_QUALIFIER_WORD}){{0,3}}\s+)?"
)
PROCESS_SUBJECT = (
    rf"(?:all|the|every|a|an)?\s*{PROCESS_QUALIFIERS}"
    r"(?:tests?|suites?|checks?|builds?|pytest|compilation|pipelines?|ci|"
    r"lints?|linting|type\s+check(?:s|ing)?|standards?|compliance)"
)
PROCESS_OUTCOME = (
    r"(?:pass(?:es|ed|ing)?|succeed(?:s|ed|ing)?|success(?:ful|fully)?|green|"
    r"run(?:s|ning)?|execut(?:e|es|ed|ing)|follow(?:s|ed|ing)?|"
    r"compl(?:y|ies|ied|ying)|compliant|clean)"
)
PROCESS_GATE = re.compile(
    rf"(?:(?:keep|ensure|require)\s+)?{PROCESS_SUBJECT}\s+"
    rf"(?:(?:is|are|be|must|should|shall)\s+)*{PROCESS_OUTCOME}"
    rf"|(?:follow(?:s|ed|ing)?|run(?:s|ning)?|execut(?:e|es|ed|ing)|"
    rf"compl(?:y|ies|ied|ying)(?:\s+with)?)\s+{PROCESS_SUBJECT}"
    rf"|{PROCESS_SUBJECT}\s+(?:(?:must|should|shall)\s+)?"
    rf"(?:is|are|be|stays?|remains?)\s+{PROCESS_OUTCOME}"
    rf"|(?:no\s+)?{PROCESS_SUBJECT}\s+(?:do(?:es)?\s+not\s+|never\s+)?fail(?:s|ed|ing)?"
    rf"|there\s+(?:is|are)\s+no\s+{PROCESS_QUALIFIERS}(?:test\s+)?failures?",
    re.IGNORECASE,
)
PROCESS_SUBJECT_FRAGMENT = re.compile(PROCESS_SUBJECT, re.IGNORECASE)
EMOJI_RANGES = (
    (0x00A9, 0x00A9),
    (0x00AE, 0x00AE),
    (0x203C, 0x203C),
    (0x2049, 0x2049),
    (0x2122, 0x2122),
    (0x2139, 0x2139),
    (0x2194, 0x2199),
    (0x21A9, 0x21AA),
    (0x231A, 0x231B),
    (0x2328, 0x2328),
    (0x23CF, 0x23CF),
    (0x23E9, 0x23F3),
    (0x23F8, 0x23FA),
    (0x24C2, 0x24C2),
    (0x25AA, 0x25AB),
    (0x25B6, 0x25B6),
    (0x25C0, 0x25C0),
    (0x25FB, 0x25FE),
    (0x2600, 0x2604),
    (0x260E, 0x260E),
    (0x2611, 0x2611),
    (0x2614, 0x2615),
    (0x2618, 0x2618),
    (0x261D, 0x261D),
    (0x2620, 0x2620),
    (0x2622, 0x2623),
    (0x2626, 0x2626),
    (0x262A, 0x262A),
    (0x262E, 0x262F),
    (0x2638, 0x263A),
    (0x2640, 0x2640),
    (0x2642, 0x2642),
    (0x2648, 0x2653),
    (0x265F, 0x2660),
    (0x2663, 0x2663),
    (0x2665, 0x2666),
    (0x2668, 0x2668),
    (0x267B, 0x267B),
    (0x267E, 0x267F),
    (0x2692, 0x2697),
    (0x2699, 0x2699),
    (0x269B, 0x269C),
    (0x26A0, 0x26A1),
    (0x26A7, 0x26A7),
    (0x26AA, 0x26AB),
    (0x26B0, 0x26B1),
    (0x26BD, 0x26BE),
    (0x26C4, 0x26C5),
    (0x26C8, 0x26C8),
    (0x26CE, 0x26CF),
    (0x26D1, 0x26D1),
    (0x26D3, 0x26D4),
    (0x26E9, 0x26EA),
    (0x26F0, 0x26F5),
    (0x26F7, 0x26FA),
    (0x26FD, 0x26FD),
    (0x2702, 0x2702),
    (0x2705, 0x2705),
    (0x2708, 0x270D),
    (0x270F, 0x270F),
    (0x2712, 0x2712),
    (0x2714, 0x2714),
    (0x2716, 0x2716),
    (0x271D, 0x271D),
    (0x2721, 0x2721),
    (0x2728, 0x2728),
    (0x2733, 0x2734),
    (0x2744, 0x2744),
    (0x2747, 0x2747),
    (0x274C, 0x274C),
    (0x274E, 0x274E),
    (0x2753, 0x2755),
    (0x2757, 0x2757),
    (0x2763, 0x2764),
    (0x2795, 0x2797),
    (0x27A1, 0x27A1),
    (0x27B0, 0x27B0),
    (0x27BF, 0x27BF),
    (0x2934, 0x2935),
    (0x2B05, 0x2B07),
    (0x2B1B, 0x2B1C),
    (0x2B50, 0x2B50),
    (0x2B55, 0x2B55),
    (0x3030, 0x3030),
    (0x303D, 0x303D),
    (0x3297, 0x3297),
    (0x3299, 0x3299),
    (0x1F004, 0x1F004),
    (0x1F0CF, 0x1F0CF),
    (0x1F170, 0x1F171),
    (0x1F17E, 0x1F17F),
    (0x1F18E, 0x1F18E),
    (0x1F191, 0x1F19A),
    (0x1F1E6, 0x1F1FF),
    (0x1F201, 0x1F202),
    (0x1F21A, 0x1F21A),
    (0x1F22F, 0x1F22F),
    (0x1F232, 0x1F23A),
    (0x1F250, 0x1F251),
    (0x1F300, 0x1F321),
    (0x1F324, 0x1F393),
    (0x1F396, 0x1F397),
    (0x1F399, 0x1F39B),
    (0x1F39E, 0x1F3F0),
    (0x1F3F3, 0x1F3F5),
    (0x1F3F7, 0x1F4FD),
    (0x1F4FF, 0x1F53D),
    (0x1F549, 0x1F54E),
    (0x1F550, 0x1F567),
    (0x1F56F, 0x1F570),
    (0x1F573, 0x1F57A),
    (0x1F587, 0x1F587),
    (0x1F58A, 0x1F58D),
    (0x1F590, 0x1F590),
    (0x1F595, 0x1F596),
    (0x1F5A4, 0x1F5A5),
    (0x1F5A8, 0x1F5A8),
    (0x1F5B1, 0x1F5B2),
    (0x1F5BC, 0x1F5BC),
    (0x1F5C2, 0x1F5C4),
    (0x1F5D1, 0x1F5D3),
    (0x1F5DC, 0x1F5DE),
    (0x1F5E1, 0x1F5E1),
    (0x1F5E3, 0x1F5E3),
    (0x1F5E8, 0x1F5E8),
    (0x1F5EF, 0x1F5EF),
    (0x1F5F3, 0x1F5F3),
    (0x1F5FA, 0x1F64F),
    (0x1F680, 0x1F6C5),
    (0x1F6CB, 0x1F6D2),
    (0x1F6D5, 0x1F6D7),
    (0x1F6DC, 0x1F6E5),
    (0x1F6E9, 0x1F6E9),
    (0x1F6EB, 0x1F6EC),
    (0x1F6F0, 0x1F6F0),
    (0x1F6F3, 0x1F6FC),
    (0x1F7E0, 0x1F7EB),
    (0x1F7F0, 0x1F7F0),
    (0x1F90C, 0x1F93A),
    (0x1F93C, 0x1F945),
    (0x1F947, 0x1F9FF),
    (0x1FA70, 0x1FA7C),
    (0x1FA80, 0x1FA88),
    (0x1FA90, 0x1FABD),
    (0x1FABF, 0x1FAC5),
    (0x1FACE, 0x1FADB),
    (0x1FAE0, 0x1FAE8),
    (0x1FAF0, 0x1FAF8),
)


@dataclass(frozen=True, slots=True)
class Violation:
    rule_id: str
    message: str


@dataclass(frozen=True, slots=True)
class ParsedMessage:
    preamble: str
    headings: tuple[str, ...]
    sections: dict[str, str]


def full_oid(value: str) -> str:
    if FULL_OID.fullmatch(value) is None:
        raise argparse.ArgumentTypeError("must be a lowercase 40-character Git OID")
    return value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scan a rendered PR message for template conformance."
    )
    parser.add_argument(
        "--body-file",
        required=True,
        help="Rendered PR body path, or - for stdin.",
    )
    parser.add_argument(
        "--template",
        type=Path,
        default=DEFAULT_TEMPLATE,
        help="Selected PR template; defaults to the bundled message.md.",
    )
    parser.add_argument(
        "--zone", required=True, choices=("green", "yellow", "red", "black")
    )
    parser.add_argument("--archetype", required=True, choices=ARCHETYPES)
    parser.add_argument("--head-oid", required=True, type=full_oid)
    parser.add_argument("--base-oid", required=True, type=full_oid)
    parser.add_argument(
        "--allow-pending-reviewers",
        action="store_true",
        help="Allow unchecked reviewer triplets during authoring only.",
    )
    parser.add_argument(
        "--generated-file",
        action="append",
        default=[],
        help="Changed generated path; repeat for every generated path.",
    )
    return parser.parse_args()


def read_body(path: str) -> str:
    if path == "-":
        return sys.stdin.read()
    return Path(path).read_text(encoding="utf-8")


def parse_message(text: str) -> ParsedMessage:
    lines = COMMENT.sub("", text).splitlines()
    preamble: list[str] = []
    headings: list[str] = []
    section_lines: dict[str, list[str]] = {}
    current: str | None = None
    fence: str | None = None

    for line in lines:
        stripped = line.lstrip()
        marker = stripped[:3]
        if fence is not None:
            if stripped.startswith(fence):
                fence = None
            if current is None:
                preamble.append(line)
            else:
                section_lines[current].append(line)
            continue
        if marker in {"```", "~~~"}:
            fence = marker
        heading = HEADING.match(line) if fence is None else None
        if heading is not None:
            current = heading.group(1)
            headings.append(current)
            section_lines.setdefault(current, [])
            continue
        if current is None:
            preamble.append(line)
        else:
            section_lines[current].append(line)

    return ParsedMessage(
        preamble="\n".join(preamble).strip(),
        headings=tuple(headings),
        sections={
            heading: "\n".join(content).strip()
            for heading, content in section_lines.items()
        },
    )


def normalized_evidence(value: str) -> str:
    text = re.sub(r"[`*_>#\[\]()-]", " ", value.lower())
    return " ".join(text.split()).strip(".,:;!?")


def normalized_placeholder_label(value: str) -> str:
    return " ".join(re.sub(r"[^\w\s]", " ", normalized_evidence(value)).split())


def placeholder_only_evidence(value: str) -> bool:
    prose = prose_without_code(value)
    saw_placeholder = False

    for line in prose.splitlines():
        placeholders = PLACEHOLDER.findall(line)
        if not placeholders:
            if normalized_evidence(line):
                return False
            continue

        saw_placeholder = True
        residue = normalized_placeholder_label(PLACEHOLDER.sub("", line))
        if not residue:
            continue

        label_options: list[tuple[str, ...]] = []
        for placeholder in placeholders:
            label = placeholder[2:-2].replace("_", " ").replace("-", " ")
            normalized = " ".join(label.lower().split())
            shortened = re.sub(r"\s+(body|content|details|text|value)$", "", normalized)
            label_options.append(tuple(dict.fromkeys((normalized, shortened))))

        expected_labels = {" ".join(labels) for labels in product(*label_options)}
        if residue not in expected_labels:
            return False

    return saw_placeholder


def is_missing_or_generic(value: str) -> bool:
    if placeholder_only_evidence(value):
        return True
    normalized = normalized_evidence(value)
    return not normalized or normalized in GENERIC


def requirements_are_process_only(value: str) -> bool:
    requirements = [
        normalized_evidence(LIST_MARKER.sub("", line))
        for line in prose_without_code(PLACEHOLDER.sub("", value)).splitlines()
        if normalized_evidence(LIST_MARKER.sub("", line))
    ]
    clauses = [
        clause
        for requirement in requirements
        for clause in (
            [requirement]
            if PROCESS_GATE.fullmatch(requirement)
            else [
                normalized_evidence(item)
                for item in PROCESS_CLAUSE_SEPARATOR.split(requirement)
                if normalized_evidence(item)
            ]
        )
    ]
    process_clauses = [PROCESS_GATE.fullmatch(clause) for clause in clauses]
    return (
        bool(clauses)
        and any(process_clauses)
        and all(
            gate or PROCESS_SUBJECT_FRAGMENT.fullmatch(clause)
            for clause, gate in zip(clauses, process_clauses, strict=True)
        )
    )


def is_emoji_prefix(prefix: str) -> bool:
    if KEYCAP_EMOJI.fullmatch(prefix):
        return True
    codepoint = ord(prefix[0])
    return any(start <= codepoint <= end for start, end in EMOJI_RANGES)


def heading_name(heading: str) -> str:
    label = heading.removeprefix("## ").removesuffix(" [ Optional ]")
    prefix, _, remainder = label.partition(" ")
    return (remainder if is_emoji_prefix(prefix) else label).casefold()


def heading_for(
    parsed_template: ParsedMessage, name: str, *, fallback: str | None = None
) -> str:
    return next(
        (
            heading
            for heading in parsed_template.headings
            if heading_name(heading) == name.casefold()
        ),
        fallback or f"## {name}",
    )


def add_heading_contract_violations(
    violations: list[Violation], parsed_template: ParsedMessage
) -> None:
    for heading in parsed_template.headings:
        prefix = heading.removeprefix("## ").split(maxsplit=1)[0]
        if not prefix or not is_emoji_prefix(prefix):
            violations.append(
                Violation("GIT-PR-02", f"section lacks an emoji prefix: {heading}")
            )


def prose_without_code(value: str) -> str:
    prose: list[str] = []
    fence: str | None = None
    for line in value.splitlines():
        stripped = line.lstrip()
        marker = stripped[:3]
        if fence is not None:
            if stripped.startswith(fence):
                fence = None
            continue
        if marker in {"```", "~~~"}:
            fence = marker
            continue
        prose.append(CODE_SPAN.sub("", line))
    return "\n".join(prose)


def generated_path_is_named(path: str, evidence: str) -> bool:
    if path in evidence:
        return True
    tokens = [*CODE_SPAN.findall(evidence), *evidence.split()]
    patterns = {
        token.strip("`'\"(){}<>.,:;")
        for token in tokens
        if any(marker in token for marker in ("*", "?", "["))
    }
    return any(fnmatch.fnmatchcase(path, pattern) for pattern in patterns)


def required_reviewer_count(zone: str) -> int:
    policy = json.loads(SIZE_POLICY.read_text(encoding="utf-8"))
    zones = policy["zones"]
    counts = {item["name"]: item["required_reviewers"] for item in zones}
    return counts.get(zone, zones[-1]["required_reviewers"])


def reviewer_triplet_count(
    verification: str,
    *,
    head_oid: str,
    base_oid: str,
    allow_pending_reviewers: bool,
) -> int:
    assigned = {
        match.group("reviewer")
        for match in REVIEWER_ASSIGNED.finditer(verification)
        if allow_pending_reviewers or match.group("checked").lower() == "x"
    }
    evidence: dict[str, dict[str, tuple[str, str]]] = {}
    for match in REVIEWER_EVIDENCE.finditer(verification):
        if not allow_pending_reviewers and match.group("checked").lower() != "x":
            continue
        if (match.group("head"), match.group("base")) != (head_oid, base_oid):
            continue
        evidence.setdefault(match.group("reviewer"), {})[match.group("action")] = (
            match.group("head"),
            match.group("base"),
        )
    return sum(
        reviewer in assigned
        and tasks.get("reviewed") is not None
        and tasks.get("reviewed") == tasks.get("approved")
        for reviewer, tasks in evidence.items()
    )


def add_required_section(
    violations: list[Violation],
    parsed: ParsedMessage,
    heading: str,
    rule_id: str,
) -> None:
    if heading not in parsed.sections:
        violations.append(Violation(rule_id, f"missing required section: {heading}"))
    elif is_missing_or_generic(parsed.sections[heading]):
        violations.append(Violation(rule_id, f"missing specific evidence: {heading}"))


def scan(
    *,
    body: str,
    template: str,
    zone: str,
    archetype: str,
    generated_files: tuple[str, ...],
    forbid_comments: bool,
    head_oid: str,
    base_oid: str,
    allow_pending_reviewers: bool,
) -> list[Violation]:
    violations: list[Violation] = []
    parsed = parse_message(body)
    parsed_template = parse_message(template)
    bundled_template = parse_message(DEFAULT_TEMPLATE.read_text(encoding="utf-8"))

    def rendered_heading(heading: str) -> str:
        return heading.removesuffix(" [ Optional ]") if forbid_comments else heading

    def selected_heading(name: str) -> str:
        bundled_heading = heading_for(bundled_template, name)
        return rendered_heading(
            heading_for(parsed_template, name, fallback=bundled_heading)
        )

    allowed = [rendered_heading(heading) for heading in parsed_template.headings]
    required_headings = [
        rendered_heading(heading)
        for heading in parsed_template.headings
        if not heading.endswith(" [ Optional ]")
    ]
    universal_sections = (
        (heading_name(heading), heading)
        for heading in bundled_template.headings
        if not heading.endswith(" [ Optional ]")
    )
    for name, bundled_heading in universal_sections:
        heading = rendered_heading(
            heading_for(parsed_template, name, fallback=bundled_heading)
        )
        if heading not in required_headings:
            required_headings.append(heading)

    add_heading_contract_violations(violations, parsed_template)

    if forbid_comments and COMMENT.search(body):
        violations.append(
            Violation("GIT-PR-02", "rendered body contains template guidance comments")
        )
    if not forbid_comments and COMMENT.findall(body) != COMMENT.findall(template):
        violations.append(
            Violation(
                "GIT-PR-02",
                "rendered body does not preserve repository template comments verbatim",
            )
        )
    if forbid_comments and PLACEHOLDER.search(prose_without_code(body)):
        violations.append(
            Violation("GIT-PR-02", "rendered body contains unresolved placeholders")
        )

    template_literals = [
        line.strip()
        for line in parsed_template.preamble.splitlines()
        if line.strip() and not PLACEHOLDER.search(line)
    ]
    body_lines = [line.strip() for line in parsed.preamble.splitlines() if line.strip()]
    if template_literals and body_lines[: len(template_literals)] != template_literals:
        violations.append(
            Violation(
                "GIT-PR-02", "rendered body does not preserve the template preamble"
            )
        )
    summary_template_heading = next(
        (
            heading
            for heading in parsed_template.headings
            if heading_name(heading) == "summary"
        ),
        None,
    )
    preamble_summary = "\n".join(
        line for line in body_lines if line not in template_literals
    )
    summary_heading = (
        rendered_heading(summary_template_heading)
        if summary_template_heading is not None
        else None
    )
    section_summary = (
        parsed.sections.get(summary_heading, "") if summary_heading else ""
    )
    summary = (
        preamble_summary if is_missing_or_generic(section_summary) else section_summary
    )
    if is_missing_or_generic(summary):
        violations.append(Violation("GIT-PR-02", "rendered body has no summary"))

    for heading in required_headings:
        add_required_section(violations, parsed, heading, "GIT-PR-02")
    requirements_heading = selected_heading("Requirements")
    requirements = parsed.sections.get(requirements_heading, "")
    if requirements and requirements_are_process_only(requirements):
        violations.append(
            Violation(
                "GIT-PR-02",
                "Requirements contains only generic process gates, not observable behavior",
            )
        )

    unknown = [heading for heading in parsed.headings if heading not in allowed]
    for heading in unknown:
        violations.append(
            Violation(
                "GIT-PR-02", f"section is not owned by the selected template: {heading}"
            )
        )

    duplicates = sorted(
        {heading for heading in parsed.headings if parsed.headings.count(heading) > 1}
    )
    for heading in duplicates:
        violations.append(
            Violation("GIT-PR-02", f"duplicate template section: {heading}")
        )

    known_positions = [
        allowed.index(heading) for heading in parsed.headings if heading in allowed
    ]
    if known_positions != sorted(known_positions):
        violations.append(Violation("GIT-PR-02", "template sections are out of order"))

    if forbid_comments:
        for heading, content in parsed.sections.items():
            if heading in allowed and is_missing_or_generic(content):
                violations.append(
                    Violation(
                        "GIT-PR-02",
                        f"included section has no specific content: {heading}",
                    )
                )

    verification_heading = selected_heading("Verification")
    verification = parsed.sections.get(verification_heading, "")
    if verification and not CHECKBOX.search(verification):
        violations.append(
            Violation("GIT-PR-02", "Verification contains no checklist item")
        )
    required_reviewers = required_reviewer_count(zone)
    if (
        reviewer_triplet_count(
            verification,
            head_oid=head_oid,
            base_oid=base_oid,
            allow_pending_reviewers=allow_pending_reviewers,
        )
        < required_reviewers
    ):
        rule_id = "GIT-PR-SIZE-02" if zone == "yellow" else "GIT-PR-SIZE-03"
        violations.append(
            Violation(
                rule_id,
                f"Verification requires {required_reviewers} confirmed reviewer "
                f"evidence triplet(s) for the {zone} zone bound to the active "
                "revision",
            )
        )

    risk_heading = selected_heading("Risk")
    test_plan_heading = selected_heading("Test Plan")
    why_size_heading = selected_heading("Why This Size")
    if zone in {"yellow", "red"}:
        add_required_section(violations, parsed, risk_heading, "GIT-PR-SIZE-02")
        add_required_section(violations, parsed, test_plan_heading, "GIT-PR-SIZE-02")
    if zone == "red":
        add_required_section(violations, parsed, why_size_heading, "GIT-PR-SIZE-03")
    if zone == "black":
        for heading in (risk_heading, test_plan_heading, why_size_heading):
            add_required_section(violations, parsed, heading, "GIT-PR-SIZE-04")

    conditional = {
        "migration": ("Rollback", "GIT-PR-TYPE-03"),
        "feature-flag": ("Feature Flag", "GIT-PR-STACK-04"),
        "ui": ("Screenshots", "GIT-PR-02"),
    }
    if archetype in conditional:
        name, rule_id = conditional[archetype]
        heading = selected_heading(name)
        add_required_section(violations, parsed, heading, rule_id)

    if generated_files:
        heading = selected_heading("Generated Files")
        add_required_section(violations, parsed, heading, "GIT-PR-TYPE-05")
        evidence = parsed.sections.get(heading, "")
        unnamed = [
            path
            for path in generated_files
            if not generated_path_is_named(path, evidence)
        ]
        if evidence and unnamed:
            violations.append(
                Violation(
                    "GIT-PR-TYPE-05",
                    "Generated Files does not name or match: " + ", ".join(unnamed),
                )
            )

    unique = {(item.rule_id, item.message): item for item in violations}
    return [unique[key] for key in sorted(unique)]


def main() -> int:
    args = parse_args()
    body = read_body(args.body_file)
    template = args.template.read_text(encoding="utf-8")
    violations = scan(
        body=body,
        template=template,
        zone=args.zone,
        archetype=args.archetype,
        generated_files=tuple(args.generated_file),
        forbid_comments=args.template.resolve() == DEFAULT_TEMPLATE.resolve(),
        head_oid=args.head_oid,
        base_oid=args.base_oid,
        allow_pending_reviewers=args.allow_pending_reviewers,
    )
    print(
        json.dumps(
            {
                "template": str(args.template.resolve()),
                "valid": not violations,
                "violations": [asdict(item) for item in violations],
            },
            sort_keys=True,
        )
    )
    return 1 if violations else 0


if __name__ == "__main__":
    raise SystemExit(main())
