"""Find manual mock or stub cleanup candidates in spec files."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import spec_files
from scanlib.rule import Rule

MANUAL_CLEANUP = re.compile(
    r"\b(?:mockReset|mockClear|mockRestore|resetAllMocks|clearAllMocks|"
    r"restoreAllMocks|unstubAllEnvs|unstubAllGlobals|reset)\b"
)
LINE_COMMENT = re.compile(r"//.*$")


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    for lineno, raw in enumerate(lines, start=1):
        if MANUAL_CLEANUP.search(LINE_COMMENT.sub("", raw)):
            matches.append(Match(path, lineno, raw.rstrip("\n")))


RULE = Rule(
    id="test-mock-cleanup",
    label="Manual mock/stub cleanup in spec file (TST-MOCK-10)",
    scan=scan,
    order=26,
    applies_to=spec_files,
    rule_refs=("TST-MOCK-10",),
)
