"""Derive the standard rule-ID prefix whitelist from marketplace standards."""

import os
import re
from pathlib import Path

# fallback whitelist, used only when the metadata glob yields nothing (e.g. the
# scanner runs outside the .claude repo). keep in sync with the live standards:
#   rg -o '`[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+-\*`' plugins/*/standards/*/meta.md
FALLBACK_PREFIXES = (
    "A11Y", "AUT", "CRV", "CSS", "DEL", "DES", "DOC", "ERR",
    "FST", "FUNC", "GEN", "GIT", "LOG", "NAM", "PYT", "RC", "RH", "RPS",
    "RST", "SB", "TST", "TYP", "WT",
)

RULE_GROUP = re.compile(r"`([A-Z][A-Z0-9]*)(?:-[A-Z0-9]+)+-\*`")


def _plugins_root() -> Path:
    """Return the `plugins/` directory containing this scanlib package."""
    # this file: plugins/coding/scripts/scanlib/prefixes.py -> parents[3] == plugins/
    return Path(__file__).resolve().parents[3]


def derive_rule_id_prefixes() -> tuple[str, ...]:
    """Return the sorted set of rule-ID prefixes found in marketplace standards.

    Globs `plugins/*/standards/*/meta.md` and takes the first segment from
    each declared rule group (e.g. `DOC-FORM-*` -> `DOC`).
    Includes standard directories supplied by an active portable lint profile.
    Falls back to the hardcoded whitelist when the glob is empty.
    """
    root = _plugins_root()
    prefixes: set[str] = set()
    meta_files = list(root.glob("*/standards/*/meta.md"))
    profile_roots = os.environ.get("CODING_LINT_STANDARD_ROOTS", "")
    meta_files.extend(
        Path(standard_root) / "meta.md"
        for standard_root in profile_roots.split(os.pathsep)
        if standard_root
    )
    for meta_file in meta_files:
        if not meta_file.is_file():
            continue
        text = meta_file.read_text(encoding="utf-8")
        prefixes.update(RULE_GROUP.findall(text))
    if not prefixes:
        return FALLBACK_PREFIXES
    return tuple(sorted(prefixes))
