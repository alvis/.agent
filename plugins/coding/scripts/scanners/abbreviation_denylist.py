"""NAM-CORE-03 candidate: non-allowlisted abbreviations as declared identifiers."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import source_files
from scanlib.rule import Rule

# NAM-CORE-03 — see plugins/coding/standards/naming/rules/nam-core-03.md
# only `fn`, `params`, `args`, `id`, `url`, `urn`, `uri`, `meta`, `info` are
# permitted abbreviations; everything else must be spelled out. detecting every
# possible abbreviation needs a dictionary, so this scanner flags a curated set
# of the most common offenders (the standard's own bad examples plus frequent
# repo abbreviations). a leading `const`/`let`/`var` anchors it to a declared
# binding to keep false positives low — incidental substrings are not matched.
DENYLISTED_ABBREVIATIONS = (
    "cfg", "usr", "repo", "ctx", "tmp", "env", "btn", "msg", "err", "req",
    "res", "val", "obj", "arr", "str", "num", "idx", "len", "fn2",
)
DENYLISTED_DECLARATION = re.compile(
    r"\b(?:const|let|var)\s+(?P<name>"
    + "|".join(DENYLISTED_ABBREVIATIONS)
    + r")\b"
)


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    for lineno, raw in enumerate(lines, start=1):
        if DENYLISTED_DECLARATION.search(raw):
            matches.append(Match(path, lineno, raw.rstrip("\n")))


RULE = Rule(
    id="abbreviation-denylist",
    label="Non-allowlisted abbreviation in identifier (NAM-CORE-03)",
    scan=scan,
    order=180,
    applies_to=source_files,
    rule_refs=("NAM-CORE-03",),
)
