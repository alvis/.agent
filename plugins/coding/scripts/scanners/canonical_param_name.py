"""NAM-TYPE-02 / FUNC-SIGN-03 candidate: non-canonical function parameter names."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import source_files
from scanlib.rule import Rule

# NAM-TYPE-02 — see plugins/coding/standards/naming/rules/nam-type-02.md
# FUNC-SIGN-03 — see plugins/coding/standards/function/rules/func-sign-03.md
# the canonical vocabulary is `params`, `query`, `input`, `options`, `data`,
# `config`, `context`, `details`, `logger`, `id`. flagging EVERY non-canonical
# parameter would be far too noisy (domain params like `user`, `amount` are
# fine), so this scanner flags only the non-semantic placeholders the standards
# explicitly call out as bad: `payload`, `cfg`, `extra`, `obj`.
NON_CANONICAL_PLACEHOLDERS = ("payload", "cfg", "extra", "obj")
# a typed parameter: `<placeholder>: <Type>` or `<placeholder>?: <Type>`,
# preceded by `(` or `,` so it sits in a parameter list rather than an object
# literal. whitespace around the tokens is tolerated.
PLACEHOLDER_PARAM = re.compile(
    r"[(,]\s*(?P<name>"
    + "|".join(NON_CANONICAL_PLACEHOLDERS)
    + r")\s*[?:]"
)


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    for lineno, raw in enumerate(lines, start=1):
        if PLACEHOLDER_PARAM.search(raw):
            matches.append(Match(path, lineno, raw.rstrip("\n")))


RULE = Rule(
    id="canonical-param-name",
    label="Non-canonical parameter name (NAM-TYPE-02, FUNC-SIGN-03)",
    scan=scan,
    order=190,
    applies_to=source_files,
    rule_refs=("NAM-TYPE-02", "FUNC-SIGN-03"),
)
