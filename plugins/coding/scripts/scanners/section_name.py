"""DOC-FORM-06 candidate: section dividers with non-standard names."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import source_files
from scanlib.rule import Rule

# DOC-FORM-06 — see plugins/coding/standards/documentation/rules/doc-form-06.md
# the standard section-name vocabulary. names MUST be UPPERCASE; a standard name
# MUST be used when it fits, otherwise a domain-specific UPPERCASE name. this
# scanner flags dividers whose name is NOT on the standard allowlist — the name
# may still be a legitimate domain-specific one, so callers re-verify per match.
STANDARD_SECTION_NAMES = {
    "IDENTIFIERS", "PROPERTIES", "DISPLAY", "FLAGS", "TIMESTAMPS",
    "RELATIONS", "AUTHENTICATION DETAILS", "PERMISSIONS", "METADATA", "INDEX",
}
# a `// --- NAME --- //` divider; capture the inner NAME text verbatim.
SECTION_DIVIDER = re.compile(r"//\s*-{2,}\s*(?P<name>.+?)\s*-{2,}\s*//")


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    for lineno, raw in enumerate(lines, start=1):
        hit = SECTION_DIVIDER.search(raw)
        if not hit:
            continue
        name = hit.group("name").strip()
        # an UPPERCASE name on the standard allowlist is compliant; anything
        # else (lowercase, or off-allowlist) is a review candidate.
        if name in STANDARD_SECTION_NAMES:
            continue
        matches.append(Match(path, lineno, raw.rstrip("\n")))


RULE = Rule(
    id="section-name",
    label="Non-standard section divider name (DOC-FORM-06)",
    scan=scan,
    order=220,
    applies_to=source_files,
    rule_refs=("DOC-FORM-06",),
)
