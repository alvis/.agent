"""TYP-CORE-03 candidate: type-escape casts (`as unknown as`, `as never`)."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import is_spec_file, source_files
from scanlib.rule import Rule

# TYP-CORE-03 — see plugins/coding/standards/typescript/rules/typ-core-03.md
# the two escape-cast forms forbidden in production code:
#   `as unknown as <Type>` — double-cast that silently discards type info
#   `as never`             — narrowing escape hatch
# whitespace between the tokens is tolerated; spec files are skipped entirely
# because TYP-TYPE-07 permits partial-cast chains in test files.
ESCAPE_CAST = re.compile(
    r"\bas\s+unknown\s+as\b"
    r"|\bas\s+never\b",
)
# strips a trailing `//` line comment so a comment that merely *mentions* the
# pattern (e.g. `// avoid as never`) is not flagged as a real cast.
LINE_COMMENT = re.compile(r"//.*$")


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    # TYP-TYPE-07 permits these casts in test files — gate them out here so the
    # scanner only flags production/runtime modules.
    if is_spec_file(path):
        return
    for lineno, raw in enumerate(lines, start=1):
        code = LINE_COMMENT.sub("", raw)
        if ESCAPE_CAST.search(code):
            matches.append(Match(path, lineno, raw.rstrip("\n")))


RULE = Rule(
    id="escape-cast",
    label="Type-escape cast (`as unknown as` / `as never`) (TYP-CORE-03)",
    scan=scan,
    order=90,
    applies_to=source_files,
    rule_refs=("TYP-CORE-03",),
)
