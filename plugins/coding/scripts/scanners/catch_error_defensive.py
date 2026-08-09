"""TYP-TYPE-08 candidate: defensive catch-block error narrowing."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import source_files
from scanlib.rule import Rule

# TYP-TYPE-08 — see plugins/coding/standards/typescript/rules/typ-type-08.md
# Detector A: defensive instanceof-Error ternary, e.g.
#   `e instanceof Error ? e.message : String(e)` (or `.stack`, `.cause`)
# The false branch is intentionally NOT pinned to `String(e)`: a string-literal
# fallback (`: 'An error occurred'`), `undefined`, or any other expression is the
# same anti-pattern and was previously slipping through. The match keys on the
# specific true branch `<id> instanceof Error ? <id>.<prop> :` (a backreference
# ties both `<id>`s to the same identifier), then accepts any fallback token.
# Allows whitespace/newlines between tokens.
CATCH_INSTANCEOF_ERROR_TERNARY = re.compile(
    r"\b(?P<id>[A-Za-z_$][\w$]*)\s+instanceof\s+Error\s*\?\s*"
    r"(?P=id)\.\w+\s*:\s*\S",
    re.DOTALL,
)
# Detector B: `String(<ident>)` whose <ident> matches an enclosing `catch (<ident>)`
# binding. Implemented as a stateful scan rather than a single regex (see scanner fn).
CATCH_BINDING = re.compile(r"\bcatch\s*\(\s*(?P<id>[A-Za-z_$][\w$]*)")
STRING_OF_IDENT = re.compile(r"\bString\s*\(\s*(?P<id>[A-Za-z_$][\w$]*)\s*\)")


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    text = "\n".join(lines)

    # Detector A — flag the instanceof-Error ternary anywhere (not just in catch),
    # because the pattern is the anti-pattern regardless of position.
    for hit in CATCH_INSTANCEOF_ERROR_TERNARY.finditer(text):
        lineno = text.count("\n", 0, hit.start()) + 1
        matches.append(Match(path, lineno, lines[lineno - 1].rstrip("\n")))

    # Detector B — String(<binding>) inside the lexical body of `catch (<binding>) { ... }`.
    # Walk catch openers, track brace depth from the opening `{`, and within that span
    # flag any `String(<binding>)`.
    pos = 0
    while True:
        opener = CATCH_BINDING.search(text, pos)
        if not opener:
            break
        binding = opener.group("id")
        # advance past `catch (id)` and find the next `{`
        brace_open = text.find("{", opener.end())
        if brace_open == -1:
            break
        depth = 1
        i = brace_open + 1
        while i < len(text) and depth > 0:
            ch = text[i]
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
            i += 1
        body = text[brace_open + 1 : i - 1]
        body_start = brace_open + 1
        for hit in STRING_OF_IDENT.finditer(body):
            if hit.group("id") != binding:
                continue
            abs_pos = body_start + hit.start()
            lineno = text.count("\n", 0, abs_pos) + 1
            matches.append(Match(path, lineno, lines[lineno - 1].rstrip("\n")))
        pos = i


RULE = Rule(
    id="catch-error-defensive",
    label="Defensive catch-block error narrowing (TYP-TYPE-08)",
    scan=scan,
    order=80,
    applies_to=source_files,
    rule_refs=("TYP-TYPE-08",),
)
