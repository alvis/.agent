"""Find parent-relative imports that traverse into src or source."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import source_files
from scanlib.rule import Rule

SOURCE_IMPORT_PATH = re.compile(
    r"['\"`][^'\"`\n]*(?:\.\./)+"
    r"(?:[^/'\"`\n]+/)*(?:src|source)(?:/|['\"`])"
)
LINE_COMMENT = re.compile(r"//.*$")


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    for lineno, raw in enumerate(lines, start=1):
        if SOURCE_IMPORT_PATH.search(LINE_COMMENT.sub("", raw)):
            matches.append(Match(path, lineno, raw.rstrip("\n")))


RULE = Rule(
    id="source-import-path",
    label="Relative import traverses into src/source (TYP-IMPT-08)",
    scan=scan,
    order=65,
    applies_to=source_files,
    rule_refs=("TYP-IMPT-08",),
)
