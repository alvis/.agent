from pathlib import Path

from contract_footprint import check_plugin

PLUGIN = Path(__file__).resolve().parents[1]

# This plugin owns both lists: hook-injected payloads and the files an injected
# payload requires without a per-moment trigger.
PAYLOADS = ("hooks/ALLAGENT.md", "hooks/MAINAGENT.md", "hooks/SUBAGENT.md")
CHAIN = ("hooks/ALLAGENT.md", "references/working-attitude.md")


def test_contract_footprint_stays_within_budget() -> None:
    assert check_plugin(PLUGIN, PAYLOADS, CHAIN) == []


def test_subagent_returns_require_runtime_task_id() -> None:
    prompt = (PLUGIN / "hooks/SUBAGENT.md").read_text(encoding="utf-8")

    assert "Per `{{PLUGIN_DIR}}/references/naming.md`, return" in prompt
    assert (
        "`<task-id> <ok|blocked: <reason>|decision: <delta>|"
        "artifact: <absolute path>>`"
    ) in prompt
