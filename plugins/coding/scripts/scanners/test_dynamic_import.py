"""TST-CORE-08 candidate: dynamic `import()` calls inside spec files."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import spec_files
from scanlib.rule import Rule

# TST-CORE-08 — see plugins/coding/standards/testing/rules/tst-core-08.md
# tests must keep imports static; ANY `import(` call in a spec file is a
# violation (static OR computed path) — broader than the production
# `dynamic-import-static` rule, which only flags statically-known paths.
# the `\bimport\s*\(` form excludes `import {…} from` static statements.
DYNAMIC_IMPORT = re.compile(r"\bimport\s*\(")
# strips a `//` line comment so a comment mentioning `import()` is not flagged.
LINE_COMMENT = re.compile(r"//.*$")


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    for lineno, raw in enumerate(lines, start=1):
        code = LINE_COMMENT.sub("", raw)
        if DYNAMIC_IMPORT.search(code):
            matches.append(Match(path, lineno, raw.rstrip("\n")))


RULE = Rule(
    id="test-dynamic-import",
    label="Dynamic `import()` in spec file (TST-CORE-08)",
    scan=scan,
    order=150,
    applies_to=spec_files,
    rule_refs=("TST-CORE-08",),
)
