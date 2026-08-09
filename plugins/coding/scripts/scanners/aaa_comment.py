"""TST-STRU-03 candidate: standalone `// Arrange` / `// Act` / `// Assert` comments."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import spec_files
from scanlib.rule import Rule

# TST-STRU-03 — see plugins/coding/standards/testing/rules/tst-stru-03.md
# matches a comment line whose sole content is an AAA section label — the rule
# forbids these because blank-line spacing already shows the structure. anchored
# to the whole line so `// Arrange the request payload` (a real explanatory
# comment) is NOT flagged; an optional trailing `:` is tolerated.
AAA_COMMENT = re.compile(r"^\s*//\s*(?:Arrange|Act|Assert)\s*:?\s*$")


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    for lineno, raw in enumerate(lines, start=1):
        if AAA_COMMENT.match(raw):
            matches.append(Match(path, lineno, raw.rstrip("\n")))


RULE = Rule(
    id="aaa-comment",
    label="AAA section comment (`// Arrange`/`// Act`/`// Assert`) (TST-STRU-03)",
    scan=scan,
    order=120,
    applies_to=spec_files,
    rule_refs=("TST-STRU-03",),
)
