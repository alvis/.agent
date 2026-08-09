import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[3]

CLAUDE = shutil.which("claude")

# these tests drive the real `claude plugin` CLI end to end; without the
# binary they cannot state anything, so they skip instead of erroring the
# whole collection run (e.g. on a CI runner without Claude Code installed).
pytestmark = pytest.mark.skipif(
    CLAUDE is None,
    reason="claude is required for plugin dependency integration tests",
)


def run_claude(config: str, *args: str) -> subprocess.CompletedProcess[str]:
    env = os.environ | {"CLAUDE_CONFIG_DIR": config}
    return subprocess.run(
        [CLAUDE, "plugin", *args],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
    )


def run_installed_hooks(
    config: str,
    *,
    plugin_root: Path,
    event: str,
    input_json: str,
) -> tuple[subprocess.CompletedProcess[str], ...]:
    hooks_document = json.loads(
        (plugin_root / "hooks/hooks.json").read_text()
    )
    substitutions = {
        "${CLAUDE_PLUGIN_ROOT}": str(plugin_root),
        "${HOME}": os.environ["HOME"],
    }
    completed = []
    for matcher in hooks_document["hooks"][event]:
        for hook in matcher["hooks"]:
            command = hook["command"]
            args = hook.get("args", [])
            for key, value in substitutions.items():
                command = command.replace(key, value)
                args = [argument.replace(key, value) for argument in args]
            invocation = [command, *args] if args else ["/bin/bash", "-c", command]
            completed.append(
                subprocess.run(
                    invocation,
                    cwd="/tmp",
                    env=os.environ | {"CLAUDE_CONFIG_DIR": config},
                    input=input_json,
                    text=True,
                    capture_output=True,
                )
            )
    return tuple(completed)


def test_react_install_and_disable_dependency_behavior(tmp_path: Path) -> None:
    config = str(tmp_path)
    added = run_claude(config, "marketplace", "add", str(ROOT))
    assert added.returncode == 0, added.stderr
    installed = run_claude(config, "install", "react@alvis")
    assert installed.returncode == 0, installed.stderr
    listed = run_claude(config, "list", "--json")
    records = {item["id"]: item for item in json.loads(listed.stdout)}
    plugins = {name: item["enabled"] for name, item in records.items()}
    assert plugins == {
        "coding@alvis": True,
        "essential@alvis": True,
        "react@alvis": True,
    }
    essential_root = Path(records["essential@alvis"]["installPath"])
    session_hook = essential_root / "hooks/scripts/session-start"
    assert session_hook.is_file()
    assert os.access(session_hook, os.X_OK)
    assert (essential_root / "hooks/scripts/subagent-start").is_file()
    hooks = run_installed_hooks(
        config,
        plugin_root=essential_root,
        event="SessionStart",
        input_json='{"source":"startup","session_id":"integration"}',
    )
    payloads = []
    for hook in hooks:
        assert hook.returncode == 0, hook.stderr
        payloads.append(json.loads(hook.stdout)["hookSpecificOutput"])
    assert payloads
    assert all(
        payload["hookEventName"] == "SessionStart" and payload["additionalContext"]
        for payload in payloads
    )
    blocked = run_claude(config, "disable", "essential@alvis")
    assert blocked.returncode != 0
    dependency_error = blocked.stderr + blocked.stdout
    assert "still required by" in dependency_error
    assert "coding" in dependency_error
    blocked = run_claude(config, "disable", "coding@alvis")
    assert blocked.returncode != 0
    assert "still required by react" in blocked.stderr + blocked.stdout
    assert run_claude(config, "disable", "react@alvis").returncode == 0
    assert run_claude(config, "disable", "coding@alvis").returncode == 0
    assert run_claude(config, "disable", "essential@alvis").returncode == 0
    listed = run_claude(config, "list", "--json")
    plugins = {item["id"]: item["enabled"] for item in json.loads(listed.stdout)}
    assert plugins == {
        "coding@alvis": False,
        "essential@alvis": False,
        "react@alvis": False,
    }


def test_essential_session_start_emits_environment_context() -> None:
    completed = subprocess.run(
        [
            str(ROOT / "plugins/essential/hooks/scripts/session-start"),
            "--plugin-dir",
            str(ROOT / "plugins/essential"),
            "--constitution-paths",
            str(ROOT / "plugins/essential"),
        ],
        input='{"source":"startup","session_id":"test"}',
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 0, completed.stderr
    output = json.loads(completed.stdout)["hookSpecificOutput"]
    assert output["hookEventName"] == "SessionStart"
    assert bool(output["additionalContext"]) is True


def test_essential_subagent_hook_emits_environment_context() -> None:
    completed = subprocess.run(
        [
            str(ROOT / "plugins/essential/hooks/scripts/subagent-start"),
            "--plugin-dir",
            str(ROOT / "plugins/essential"),
            "--constitution-paths",
            str(ROOT / "plugins/essential"),
        ],
        input='{"session_id":"test"}',
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 0, completed.stderr
    output = json.loads(completed.stdout)["hookSpecificOutput"]
    assert output["hookEventName"] == "SubagentStart"
    assert bool(output["additionalContext"]) is True
