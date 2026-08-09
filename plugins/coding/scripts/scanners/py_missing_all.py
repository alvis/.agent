"""PYT-IMPT-05 candidate: public package `__init__.py` with re-exports but no `__all__`."""

import re
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import python_files
from scanlib.rule import Rule

# PYT-IMPT-05 — see plugins/coding/standards/python/rules/pyt-impt-05.md
# every public package `__init__.py` MUST declare `__all__`. ruff's F822 only
# flags undefined names *inside* `__all__`, never an `__init__.py` that omits it
# entirely — this scanner covers that gap.
# a genuine re-export is a `from <module> import <names>` statement — it pulls
# names INTO the package surface. `from __future__ import ...` (a compiler
# directive) and bare `import x` / `import x.y` (stdlib-style module binding)
# are NOT re-exports; the negative lookahead excludes the `__future__` case and
# the `from` anchor excludes bare imports.
REEXPORT = re.compile(r"^\s*from\s+(?!__future__\b)[\w.]+\s+import\s+")
# the `__all__` declaration anywhere in the file.
ALL_DECLARATION = re.compile(r"^\s*__all__\s*[:=]")


def _is_private_package(path: Path, /) -> bool:
    """true iff any package directory in the path starts with an underscore."""
    # the file itself is `__init__.py`; inspect only the directory parts.
    return any(part.startswith("_") for part in path.parent.parts)


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    # this rule targets public package `__init__.py` files only.
    if path.name != "__init__.py" or _is_private_package(path):
        return
    has_reexport = False
    reexport_lineno = 0
    for lineno, raw in enumerate(lines, start=1):
        if ALL_DECLARATION.match(raw):
            # `__all__` is present — the package is compliant.
            return
        if not has_reexport and REEXPORT.match(raw):
            has_reexport = True
            reexport_lineno = lineno
    if not has_reexport:
        # no re-exports — an empty package `__init__.py` needs no `__all__`.
        return
    matches.append(Match(path, reexport_lineno, lines[reexport_lineno - 1].rstrip("\n")))


RULE = Rule(
    id="py-missing-all",
    label="Public package `__init__.py` re-exports without `__all__` (PYT-IMPT-05)",
    scan=scan,
    order=250,
    applies_to=python_files,
    rule_refs=("PYT-IMPT-05",),
)
