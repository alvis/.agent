from pathlib import Path

from contract_footprint import check_plugin

PLUGIN = Path(__file__).resolve().parents[1]

PAYLOADS = ("hooks/ALLAGENT.md",)
CHAIN = ("hooks/ALLAGENT.md",)


def test_contract_footprint_stays_within_budget() -> None:
    assert check_plugin(PLUGIN, PAYLOADS, CHAIN) == []
