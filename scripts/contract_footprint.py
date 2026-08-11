#!/usr/bin/env python3
"""Budget checks a plugin runs against the context it forces on every session."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable


__all__ = [
    "CHAIN_BUDGET_BYTES",
    "INJECTED_PAYLOADS",
    "PAYLOAD_BUDGET_BYTES",
    "check_plugin",
]


# The files a plugin may register for hook injection. `hooks/ALLAGENT.md` is
# re-read at both SessionStart and SubagentStart, `hooks/MAINROLE.md` and
# `hooks/MAINAGENT.md` at SessionStart, and `hooks/SUBAGENT.md` at
# SubagentStart, so each is capped on its own.
INJECTED_PAYLOADS = (
    "hooks/ALLAGENT.md",
    "hooks/MAINROLE.md",
    "hooks/MAINAGENT.md",
    "hooks/SUBAGENT.md",
)
PAYLOAD_BUDGET_BYTES = 2_000

# The unconditional read chain created by hook injection. References guarded by
# a per-moment trigger are excluded because a session reads them only when that
# trigger occurs.
CHAIN_BUDGET_BYTES = 40_960


def check_plugin(
    plugin_root: Path,
    payloads: Iterable[str],
    chain: Iterable[str],
) -> list[str]:
    """Return every violation for one plugin, empty when it is within budget.

    The caller owns both lists, so a plugin declares its own contract rather
    than reading it out of a roster kept somewhere else.
    """

    # A bare string is iterable one character at a time, which would report ten
    # missing files instead of the one declaration the caller meant.
    for name, value in (("payloads", payloads), ("chain", chain)):
        if isinstance(value, str):
            raise TypeError(f"{name} must be a sequence of file names, not a str")

    declared_payloads = tuple(payloads)
    violations: list[str] = []

    for relative in declared_payloads:
        path = plugin_root / relative
        if not path.is_file():
            violations.append(
                f"{plugin_root.name}/{relative} is declared as an injected "
                "payload but does not exist; update the declaration or restore "
                "the file."
            )
            continue
        size = path.stat().st_size
        if size > PAYLOAD_BUDGET_BYTES:
            violations.append(
                f"{plugin_root.name}/{relative} is {size} bytes; budget is "
                f"{PAYLOAD_BUDGET_BYTES}. Every session pays this file, so move "
                "detail into a reference instead of growing it."
            )

    # A payload the plugin ships but forgot to declare would otherwise buy
    # itself an unbudgeted seat in every session.
    for relative in INJECTED_PAYLOADS:
        if relative in declared_payloads:
            continue
        if (plugin_root / relative).is_file():
            violations.append(
                f"{plugin_root.name}/{relative} is injected at runtime but is "
                "not declared here, so its budget is never checked; add it to "
                "the declaration."
            )

    sizes: dict[str, int] = {}
    for relative in chain:
        path = plugin_root / relative
        if not path.is_file():
            violations.append(
                f"{plugin_root.name}/{relative} is named in the mandatory chain "
                "but does not exist; update the declaration or restore the file."
            )
            continue
        sizes[relative] = path.stat().st_size

    total = sum(sizes.values())
    if total > CHAIN_BUDGET_BYTES:
        breakdown = ", ".join(f"{name}={size}" for name, size in sizes.items())
        violations.append(
            f"{plugin_root.name} unconditional read chain is {total} bytes "
            f"({breakdown}); budget is {CHAIN_BUDGET_BYTES}. Move detail into a "
            "per-moment reference instead of growing an always-read file."
        )

    return violations
