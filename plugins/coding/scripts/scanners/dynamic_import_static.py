"""TYP-IMPT-07 candidate: dynamic `import()` with a static (non-interpolated) path."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import source_files
from scanlib.rule import Rule

# TYP-IMPT-07 — see plugins/coding/standards/typescript/rules/typ-impt-07.md
# matches `import(<literal>)` where the argument is a string literal or a backtick
# template literal WITHOUT `${...}`. Catches BOTH runtime (`await import('./x')`)
# and type-position (`typeof import('./x')`, `import('./x').Foo`) usages — the regex
# doesn't care about context; the vi.mock/vi.hoist exception is applied per match.
DYNAMIC_IMPORT_STATIC = re.compile(
    r"\bimport\s*\(\s*"
    r"(?:'[^'\n]*'|\"[^\"\n]*\"|`[^`$\n]*`)"
    r"\s*\)",
)
# header for the exempted scope — `vi.mock(` or `vi.hoist(` (optional whitespace
# allowed around `.`). The trailing `(` is included so `m.end()` lands just past it.
VI_MOCK_OR_HOIST_HEAD = re.compile(r"\bvi\s*\.\s*(?:mock|hoist)\s*\(")


def _inside_vi_mock_or_hoist(*, text: str, pos: int) -> bool:
    """true iff `pos` lies inside an unclosed `vi.mock(` / `vi.hoist(` call.

    walks through every `vi.mock(`/`vi.hoist(` opener that appears before `pos`,
    counting parens between the opener and `pos`. since the opener's own `(` is
    consumed by the regex match (and thus excluded from the segment), we are still
    inside iff opens >= closes in the segment.
    """
    for head in VI_MOCK_OR_HOIST_HEAD.finditer(text, 0, pos):
        segment = text[head.end():pos]
        if segment.count("(") >= segment.count(")"):
            return True
    return False


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    text = "\n".join(lines)
    for hit in DYNAMIC_IMPORT_STATIC.finditer(text):
        if _inside_vi_mock_or_hoist(text=text, pos=hit.start()):
            continue
        lineno = text.count("\n", 0, hit.start()) + 1
        matches.append(Match(path, lineno, lines[lineno - 1].rstrip("\n")))


RULE = Rule(
    id="dynamic-import-static",
    label="Dynamic `import()` with static path (TYP-IMPT-07)",
    scan=scan,
    order=60,
    applies_to=source_files,
    rule_refs=("TYP-IMPT-07",),
)
