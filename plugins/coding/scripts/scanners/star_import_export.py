"""TYP-IMPT-03 / TYP-MODL-04 candidate: `import * as` and `export *` wildcards."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import source_files
from scanlib.rule import Rule

# TYP-IMPT-03 — see plugins/coding/standards/typescript/rules/typ-impt-03.md
# TYP-MODL-04 — see plugins/coding/standards/typescript/rules/typ-modl-04.md
# matches BOTH wildcard forms at the start of a line (after indentation):
#   `import * as ns from '…'`   — forbidden namespace import (TYP-IMPT-03)
#   `export * from '…'`         — barrel wildcard re-export; legitimate only when
#                                 the source is itself a barrel (TYP-MODL-04) —
#                                 a reviewer confirms the barrel level per match
# `export * as ns from '…'` is also covered by the optional `(?:as\s+\w+\s+)?`.
STAR_IMPORT_EXPORT = re.compile(
    r"^\s*import\s+\*\s+as\s+\w"
    r"|^\s*export\s+\*\s+(?:as\s+\w+\s+)?from\b",
)


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    for lineno, raw in enumerate(lines, start=1):
        if STAR_IMPORT_EXPORT.match(raw):
            matches.append(Match(path, lineno, raw.rstrip("\n")))


RULE = Rule(
    id="star-import-export",
    label="Wildcard `import * as` / `export *` (TYP-IMPT-03, TYP-MODL-04)",
    scan=scan,
    order=100,
    applies_to=source_files,
    rule_refs=("TYP-IMPT-03", "TYP-MODL-04"),
)
