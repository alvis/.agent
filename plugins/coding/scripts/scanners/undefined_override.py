"""TST-DATA-04 candidate: explicit `key: undefined` in call-argument objects."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import spec_files
from scanlib.rule import Rule

# TST-DATA-04 — see plugins/coding/standards/testing/rules/tst-data-04.md
# explicit `undefined` overrides (`createUser({ role: undefined })`) must be
# omitted, not passed. matches a `<key>: undefined` property anywhere inside a
# call argument object literal — `(` then `{` open before the property and a
# matching `})` closes after. operating on the joined text handles multi-line
# override objects. type-annotation forms (`role: undefined` as a TYPE) are
# excluded because those never sit inside a `({ … })` call-argument span.
PROP_UNDEFINED = re.compile(r"\b(?P<key>[\w$]+)\s*:\s*undefined\b")
# a call opener whose first non-space token is `{` — i.e. `fn({` / `fn( {`.
CALL_OBJECT_OPEN = re.compile(r"\(\s*\{")


def _inside_call_object(*, text: str, pos: int) -> bool:
    """true iff `pos` lies inside an unclosed `(... {` call-argument object.

    walks every `({` opener before `pos` and balances braces between the
    opener's `{` and `pos`; still inside iff opens exceed closes.
    """
    for opener in CALL_OBJECT_OPEN.finditer(text, 0, pos):
        brace = text.find("{", opener.start())
        if brace == -1 or brace >= pos:
            continue
        segment = text[brace + 1 : pos]
        if segment.count("{") >= segment.count("}"):
            return True
    return False


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    text = "\n".join(lines)
    for hit in PROP_UNDEFINED.finditer(text):
        if not _inside_call_object(text=text, pos=hit.start()):
            continue
        lineno = text.count("\n", 0, hit.start()) + 1
        matches.append(Match(path, lineno, lines[lineno - 1].rstrip("\n")))


RULE = Rule(
    id="undefined-override",
    label="Explicit `key: undefined` override in call argument (TST-DATA-04)",
    scan=scan,
    order=210,
    applies_to=spec_files,
    rule_refs=("TST-DATA-04",),
)
