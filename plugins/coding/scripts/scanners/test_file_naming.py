"""TST-STRU-01 candidate: test files using the `.test.ts` extension."""

from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import source_files
from scanlib.rule import Rule

# TST-STRU-01 — see plugins/coding/standards/testing/rules/tst-stru-01.md
# the standard mandates `.spec.ts(x)` (and `.int.spec.*` / `.e2e.spec.*`); the
# legacy `.test.ts(x)` extension is a violation. this is a pure path check.
TEST_SUFFIXES = (".test.ts", ".test.tsx")


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    name = path.name
    if not any(name.endswith(suffix) for suffix in TEST_SUFFIXES):
        return
    # the file name itself is the violation — report it on line 1 so the match
    # has a stable anchor regardless of the file's contents.
    first = lines[0].rstrip("\n") if lines else ""
    matches.append(Match(path, 1, first))


RULE = Rule(
    id="test-file-naming",
    label="Test file uses `.test.*` instead of `.spec.*` (TST-STRU-01)",
    scan=scan,
    order=140,
    applies_to=source_files,
    rule_refs=("TST-STRU-01",),
)
