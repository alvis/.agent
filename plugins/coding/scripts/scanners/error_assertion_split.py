"""TST-DATA-07 candidate: split error assertions in spec files."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import is_spec_file
from scanlib.rule import Rule

# TST-DATA-07 — see plugins/coding/standards/testing/rules/tst-data-07.md
# an error should be asserted as a whole via `expect(error).toEqual(new Error('…'))`,
# not split into a `toBeInstanceOf(<…>Error)` check plus a separate `.message`/
# `.cause`/`.name` assertion. flag the `toBeInstanceOf` line whenever the same
# subject is also asserted on `.message`/`.cause`/`.name` anywhere in the file —
# that co-occurrence is the split pattern.
INSTANCEOF_ERROR = re.compile(
    r"expect\(\s*(?P<id>[A-Za-z_$][\w$]*)\s*\)\s*\.toBeInstanceOf\(\s*"
    r"(?P<typ>[A-Za-z_$][\w$]*)\s*\)",
)
# `.message`/`.cause`/`.name` assertion on a subject, e.g. `expect(error.message)`
# or the cast form `expect((error as Error).message)`.
FIELD_ASSERT = re.compile(
    r"expect\(\s*\(?\s*(?P<id>[A-Za-z_$][\w$]*)\b[^)\n]*\)?\s*"
    r"\.(?:message|cause|name)\b",
)
# strips a trailing `//` line comment so a comment that merely *mentions* the
# pattern is not flagged as a real assertion.
LINE_COMMENT = re.compile(r"//.*$")


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    # spec-only; the engine already gates via `applies_to`, but guard here too
    # so a stray non-spec invocation stays silent.
    if not is_spec_file(path):
        return

    codes = [LINE_COMMENT.sub("", raw) for raw in lines]

    # subjects asserted field-by-field (`.message`/`.cause`/`.name`) anywhere.
    field_subjects = {
        m.group("id") for code in codes for m in FIELD_ASSERT.finditer(code)
    }

    for lineno, code in enumerate(codes, start=1):
        for hit in INSTANCEOF_ERROR.finditer(code):
            typ = hit.group("typ")
            # only error types: `Error` itself or any `*Error` subclass.
            if typ != "Error" and not typ.endswith("Error"):
                continue
            if hit.group("id") in field_subjects:
                matches.append(Match(path, lineno, lines[lineno - 1].rstrip("\n")))


RULE = Rule(
    id="error-assertion-split",
    label="Split error assertion — collapse to `expect(error).toEqual(new Error('…'))` (TST-DATA-07)",
    scan=scan,
    order=92,
    applies_to=is_spec_file,
    rule_refs=("TST-DATA-07",),
)
