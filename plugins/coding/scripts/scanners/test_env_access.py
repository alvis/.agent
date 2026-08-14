"""Find direct environment or global access candidates in spec files."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import spec_files
from scanlib.rule import Rule

DIRECT_ENV_OR_GLOBAL = re.compile(
    r"(?<![\w$.])(?:"
    r"process\s*(?:\.\s*env|\[\s*(?P<quote>['\"])env(?P=quote)\s*\])"
    r"|(?:global|globalThis|self|window)\s*(?:\.|\[\s*['\"])"
    r")"
)
LINE_COMMENT = re.compile(r"//.*$")


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    for lineno, raw in enumerate(lines, start=1):
        if DIRECT_ENV_OR_GLOBAL.search(LINE_COMMENT.sub("", raw)):
            matches.append(Match(path, lineno, raw.rstrip("\n")))


RULE = Rule(
    id="test-env-access",
    label="Direct process.env/global access in spec file (TST-MOCK-11)",
    scan=scan,
    order=25,
    applies_to=spec_files,
    rule_refs=("TST-MOCK-11",),
)
