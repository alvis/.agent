"""TST-CORE-11 candidate: `runIf`/`skipIf` conditional test skips in spec files."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import spec_files
from scanlib.rule import Rule

# TST-CORE-11 — see plugins/coding/standards/testing/rules/tst-core-11.md
# matches `describe.runIf` / `it.runIf` / `test.runIf` and the `.skipIf` variant.
# both silently skip tests when config is missing — the rule mandates a hard
# file-level throw instead. whitespace around the `.` is tolerated.
CONDITIONAL_SKIP = re.compile(r"\b(?:describe|it|test)\s*\.\s*(?:runIf|skipIf)\b")
# strips a `//` line comment so a comment mentioning `describe.runIf` is not
# mistaken for a real call site.
LINE_COMMENT = re.compile(r"//.*$")


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    for lineno, raw in enumerate(lines, start=1):
        code = LINE_COMMENT.sub("", raw)
        if CONDITIONAL_SKIP.search(code):
            matches.append(Match(path, lineno, raw.rstrip("\n")))


RULE = Rule(
    id="test-conditional-skip",
    label="Conditional test skip (`runIf`/`skipIf`) (TST-CORE-11)",
    scan=scan,
    order=110,
    applies_to=spec_files,
    rule_refs=("TST-CORE-11",),
)
