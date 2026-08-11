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
            shortened = re.sub(
                r"\s+(body|content|details|text|value)$", "", normalized
            )
            label_options.append(tuple(dict.fromkeys((normalized, shortened))))

        expected_labels = {
            " ".join(labels) for labels in product(*label_options)
        }
        if residue not in expected_labels:
            return False

    return saw_placeholder


def is_missing_or_generic(value: str) -> bool:
    if placeholder_only_evidence(value):
        return True
    normalized = normalized_evidence(value)
    return not normalized or normalized in GENERIC


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
    allowed = list(parsed_template.headings)

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
    summary_lines = [line for line in body_lines if line not in template_literals]
    if is_missing_or_generic("\n".join(summary_lines)):
        violations.append(Violation("GIT-PR-02", "rendered body has no summary"))

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

    add_required_section(violations, parsed, "## 🧪 Verification", "GIT-PR-02")
    verification = parsed.sections.get("## 🧪 Verification", "")
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

    if zone in {"yellow", "red"}:
        add_required_section(violations, parsed, "## Risk", "GIT-PR-SIZE-02")
        add_required_section(violations, parsed, "## Test plan", "GIT-PR-SIZE-02")
    if zone == "red":
        add_required_section(violations, parsed, "## Why this size", "GIT-PR-SIZE-03")
    if zone == "black":
        for heading in ("## Risk", "## Test plan", "## Why this size"):
            add_required_section(violations, parsed, heading, "GIT-PR-SIZE-04")

    conditional = {
        "migration": ("## ⏪ Rollback", "GIT-PR-TYPE-03"),
        "feature-flag": ("## 🚩 Feature Flag", "GIT-PR-STACK-04"),
        "ui": ("## 🖼️ Screenshots", "GIT-PR-02"),
    }
    if archetype in conditional:
        heading, rule_id = conditional[archetype]
        add_required_section(violations, parsed, heading, rule_id)

    if generated_files:
        heading = "## 🏭 Generated Files"
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
