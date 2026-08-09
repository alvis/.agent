"""DOC-CONT-05 candidate: standard rule IDs (e.g. DOC-FORM-03) inside comments."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import source_files
from scanlib.prefixes import derive_rule_id_prefixes
from scanlib.rule import Rule

# DOC-CONT-05 — see plugins/coding/standards/documentation/rules/doc-cont-05.md
# matches a known standard prefix followed by 1-3 hyphen-separated segments.
# each trailing segment is either an UPPERCASE word (>=2 chars) or 1-3 digits.
# the prefix whitelist is derived at import time from live standard `meta.md`
# rule groups (`scanlib.prefixes.derive_rule_id_prefixes`) — no hardcoded drift.
RULE_ID_PREFIXES = derive_rule_id_prefixes()
RULE_ID_TOKEN = re.compile(
    r"\b(?:" + "|".join(RULE_ID_PREFIXES) + r")"
    r"(?:-(?:[A-Z]{2,10}|\d{1,3})){1,3}\b",
)
# per-line comment-scope detector: line-comment `//`, block-comment opener
# `/*`, or JSDoc continuation line (leading `*` after whitespace).
COMMENT_SCOPE = re.compile(r"(?://|/\*+|^\s*\*\s)")


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    """flag rule-ID-shaped tokens inside source comments.

    iterates physical lines, identifies the first comment opener per line
    (line `//`, block `/*`, or JSDoc continuation `*`), and searches for a
    rule-ID token in the substring from that point onward. multi-line block
    comments without a `*` prefix on each line are tracked via a simple
    in_block flag mirroring how jsdoc_prose_lines handles JSDoc opens/closes.
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
            m = COMMENT_SCOPE.search(line)
            if m:
                scope_start = m.start()
                if "/*" in line and "*/" not in line[m.start():]:
                    in_block = True
        if scope_start is None:
            continue
        if RULE_ID_TOKEN.search(line, scope_start):
            matches.append(Match(path, lineno, line))


RULE = Rule(
    id="comment-rule-id",
    label="Standard rule ID in source comment (DOC-CONT-05)",
    scan=scan,
    order=70,
    applies_to=source_files,
    rule_refs=("DOC-CONT-05",),
)
