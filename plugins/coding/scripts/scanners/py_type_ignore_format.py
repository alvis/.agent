"""PYT-CORE-03 candidate: `# type: ignore` not in the mandated `[code]  # reason:` form."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import python_files
from scanlib.rule import Rule

# PYT-CORE-03 — see plugins/coding/standards/python/rules/pyt-core-03.md
# every suppression MUST read exactly `# type: ignore[code]  # reason: <text>`
# — a specific error code AND a reason comment separated by two spaces.
TYPE_IGNORE = re.compile(r"#\s*type:\s*ignore(?P<tail>.*)$")
# the compliant tail: `[code]` immediately after `ignore`, then exactly two
# spaces, then a `# reason:` comment with non-empty justification text.
COMPLIANT_TAIL = re.compile(r"^\[[^\]\s]+\]  # reason:\s*\S")


def _comment_start(line: str, /) -> int:
    """return the index of the real `#` comment opener, or -1 if none.

    scans left to right tracking single/double quote state so a `#` inside a
    string literal (`label = "# type: ignore"`) is not mistaken for a comment.
    """
    quote: str | None = None
    for idx, ch in enumerate(line):
        if quote is not None:
            if ch == quote:
                quote = None
            continue
        if ch in ("'", '"'):
            quote = ch
        elif ch == "#":
            return idx
    return -1


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    for lineno, raw in enumerate(lines, start=1):
        start = _comment_start(raw)
        if start == -1:
            continue
        comment = raw[start:]
        # the directive must OPEN the comment — reject a mid-comment mention
        # such as `# see # type: ignore`.
        hit = TYPE_IGNORE.match(comment)
        if not hit:
            continue
        if COMPLIANT_TAIL.match(hit.group("tail")):
            continue
        matches.append(Match(path, lineno, raw.rstrip("\n")))


RULE = Rule(
    id="py-type-ignore-format",
    label="`# type: ignore` missing `[code]  # reason:` form (PYT-CORE-03)",
    scan=scan,
    order=230,
    applies_to=python_files,
    rule_refs=("PYT-CORE-03",),
)
