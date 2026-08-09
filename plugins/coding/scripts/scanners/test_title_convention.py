"""TST-CORE-03 candidate: non-canonical `it(...)` / `describe(...)` titles."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import spec_files
from scanlib.rule import Rule

# TST-CORE-03 — see plugins/coding/standards/testing/rules/tst-core-03.md
# the approved symbol-scoped describe prefixes; a symbol-style title that opens
# with `<word>:` must use one of these. general-purpose titles carry NO prefix
# and are never flagged here (they have no `<word>:` head).
APPROVED_PREFIXES = (
    "fn", "op", "sv", "cl", "mt", "gt", "st", "re", "ty", "rc", "hk", "cmd",
)
# `it('…')` / `it("…")` — capture the string-literal title only. template
# literals and variable titles are intentionally skipped (no quote head).
IT_TITLE = re.compile(r"\bit\s*\(\s*(['\"])(?P<title>.*?)\1")
# `describe('…')` / `describe("…")` — string-literal title only.
DESCRIBE_TITLE = re.compile(r"\bdescribe\s*\(\s*(['\"])(?P<title>.*?)\1")
# a prefix-style head: a short lowercase token immediately followed by `:`.
# only such titles are treated as symbol-scoped; everything else is taken as a
# general-purpose title and left alone.
PREFIX_HEAD = re.compile(r"^(?P<prefix>[a-z]{1,5}):")


def _flag_it(*, path: Path, lineno: int, line: str, matches: list[Match]) -> None:
    """flag an `it(...)` title that does not start with `should`."""
    for hit in IT_TITLE.finditer(line):
        title = hit.group("title").strip()
        if not title:
            continue
        if not title.lower().startswith("should"):
            matches.append(Match(path, lineno, line))
            return


def _flag_describe(*, path: Path, lineno: int, line: str, matches: list[Match]) -> None:
    """flag a `describe(...)` symbol title using a wrong/missing prefix."""
    for hit in DESCRIBE_TITLE.finditer(line):
        title = hit.group("title").strip()
        head = PREFIX_HEAD.match(title)
        if not head:
            # no `<word>:` head — treated as a general-purpose title, allowed.
            continue
        if head.group("prefix") not in APPROVED_PREFIXES:
            matches.append(Match(path, lineno, line))
            return


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    for lineno, raw in enumerate(lines, start=1):
        line = raw.rstrip("\n")
        _flag_it(path=path, lineno=lineno, line=line, matches=matches)
        _flag_describe(path=path, lineno=lineno, line=line, matches=matches)


RULE = Rule(
    id="test-title-convention",
    label="Non-canonical test title (`it`/`describe`) (TST-CORE-03)",
    scan=scan,
    order=130,
    applies_to=spec_files,
    rule_refs=("TST-CORE-03",),
)
