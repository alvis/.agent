"""DOC-CONT-03 candidate: author/date stamps in source comments."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import source_files
from scanlib.rule import Rule

# DOC-CONT-03 — see plugins/coding/standards/documentation/rules/doc-cont-03.md
# forbidden comment patterns: author/date stamps and modified-by history. two
# detectors, applied only to the comment-scope portion of each line:
#   `(modified|updated|created|authored) by`  — authorship attribution
#   a bare `YYYY-MM-DD` date stamp            — history that belongs in git
AUTHOR_STAMP = re.compile(
    r"\b(?:modified|updated|created|authored)\s+by\b"
    r"|\b\d{4}-\d{2}-\d{2}\b",
    re.IGNORECASE,
)
# per-line comment-scope detector — mirrors the comment-rule-id scanner: line
# comment `//`, block-comment opener `/*`, or a JSDoc continuation line.
COMMENT_SCOPE = re.compile(r"(?://|/\*+|^\s*\*\s)")


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    """flag author/date stamps that appear inside source comments only.

    iterates physical lines, locates the first comment opener per line, and
    searches for a stamp pattern from that point onward. multi-line block
    comments are tracked with a simple in_block flag.
    """
    in_block = False
    for lineno, raw in enumerate(lines, start=1):
        line = raw.rstrip("\n")
        scope_start: int | None = None
        if in_block:
            scope_start = 0
            if "*/" in line:
                in_block = False
        else:
            opener = COMMENT_SCOPE.search(line)
            if opener:
                scope_start = opener.start()
                if "/*" in line and "*/" not in line[opener.start():]:
                    in_block = True
        if scope_start is None:
            continue
        if AUTHOR_STAMP.search(line, scope_start):
            matches.append(Match(path, lineno, line))


RULE = Rule(
    id="author-stamp",
    label="Author/date stamp in source comment (DOC-CONT-03)",
    scan=scan,
    order=160,
    applies_to=source_files,
    rule_refs=("DOC-CONT-03",),
)
