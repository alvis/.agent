"""NAM-CORE-04 candidate: time/measurement identifiers without a unit suffix."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import source_files
from scanlib.rule import Rule

# NAM-CORE-04 — see plugins/coding/standards/naming/rules/nam-core-04.md
# bare time-related names hide their unit and invite conversion bugs. flags a
# declaration whose identifier is EXACTLY one of the disallowed bare names —
# `timeoutMs`, `delaySeconds` etc. are not matched because the bare token must
# stand alone (`\b` boundaries, no trailing word characters). a leading `const`
# / `let` / `var` anchors it to a declaration to keep false positives low.
BARE_UNIT_NAME = re.compile(
    r"\b(?:const|let|var)\s+(?P<name>timeout|delay|duration|interval)\b"
)


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    for lineno, raw in enumerate(lines, start=1):
        if BARE_UNIT_NAME.search(raw):
            matches.append(Match(path, lineno, raw.rstrip("\n")))


RULE = Rule(
    id="unit-suffix",
    label="Time/measurement identifier without unit suffix (NAM-CORE-04)",
    scan=scan,
    order=170,
    applies_to=source_files,
    rule_refs=("NAM-CORE-04",),
)
