"""ERR-HAND-02 candidate: silent `catch` blocks that swallow the error."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import source_files
from scanlib.rule import Rule

# ERR-HAND-02 — see plugins/coding/standards/observability/rules/err-hand-02.md
# eslint `no-empty` catches a fully empty `catch {}` but NOT a catch whose body
# is a bare `return` — a silent swallow that still drops the error. matches
# `catch (e) { return }` / `catch { return; }` across line breaks; the body
# must be a lone `return` (optional value, optional `;`) and nothing else.
# matched against comment-stripped text so a `// swallow on purpose` note
# between the brace and the `return` does not defeat detection.
SILENT_CATCH = re.compile(
    r"\bcatch\s*(?:\(\s*[\w$]*\s*\))?\s*\{\s*return\s*;?\s*\}",
    re.DOTALL,
)
# strips a `//` line comment, preserving the line so newline offsets are stable.
LINE_COMMENT = re.compile(r"//[^\n]*")


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    text = LINE_COMMENT.sub("", "\n".join(lines))
    for hit in SILENT_CATCH.finditer(text):
        lineno = text.count("\n", 0, hit.start()) + 1
        matches.append(Match(path, lineno, lines[lineno - 1].rstrip("\n")))


RULE = Rule(
    id="silent-catch",
    label="Silent `catch` block (`catch { return }`) (ERR-HAND-02)",
    scan=scan,
    order=200,
    applies_to=source_files,
    rule_refs=("ERR-HAND-02",),
)
