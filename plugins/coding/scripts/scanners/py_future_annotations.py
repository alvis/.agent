"""PYT-IMPT-03 candidate: forbidden `from __future__ import annotations`."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import python_files
from scanlib.rule import Rule

# PYT-IMPT-03 — see plugins/coding/standards/python/rules/pyt-impt-03.md
# `from __future__ import annotations` is forbidden — it stringifies every
# annotation (PEP 563) and breaks dataclass/Pydantic runtime introspection.
# ruff has no rule against it (it ships the opposite FA100/FA102), so the
# scanner covers it. anchored at line start (after indentation) to match the
# real import statement, not an incidental mention.
FUTURE_ANNOTATIONS = re.compile(
    r"^\s*from\s+__future__\s+import\s+(?:[\w,\s]*\b)?annotations\b"
)


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    for lineno, raw in enumerate(lines, start=1):
        if FUTURE_ANNOTATIONS.match(raw):
            matches.append(Match(path, lineno, raw.rstrip("\n")))


RULE = Rule(
    id="py-future-annotations",
    label="Forbidden `from __future__ import annotations` (PYT-IMPT-03)",
    scan=scan,
    order=240,
    applies_to=python_files,
    rule_refs=("PYT-IMPT-03",),
)
