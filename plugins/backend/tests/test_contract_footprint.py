from __future__ import annotations

from pathlib import Path

from contract_footprint import check_plugin

PLUGIN = Path(__file__).resolve().parents[1]

# This plugin owns both lists: hook-injected payloads and the files an injected
# payload requires without a per-moment trigger.
PAYLOADS = (
    "hooks/ALLAGENT.md",
    "hooks/MAINROLE.md",
    "hooks/MAINAGENT.md",
)
CHAIN = ("hooks/ALLAGENT.md",)


def test_contract_footprint_stays_within_budget() -> None:
    assert check_plugin(PLUGIN, PAYLOADS, CHAIN) == []
