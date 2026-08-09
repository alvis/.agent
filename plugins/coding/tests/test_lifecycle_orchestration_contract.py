from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess

import pytest


PLUGIN = Path(__file__).resolve().parents[1]
CRITIC_FRONTMATTER = (
    PLUGIN / "agents/code-quality-critic/frontmatter/claude.json"
)

pytestmark = pytest.mark.skipif(
    not shutil.which("jq"), reason="code-quality hook requires jq"
)


@pytest.fixture(scope="module")
def command() -> str:
    data = json.loads(CRITIC_FRONTMATTER.read_text(encoding="utf-8"))
    return data["hooks"]["PreToolUse"][0]["hooks"][0]["command"]


def run_hook(command: str, path: str) -> str:
    result = subprocess.run(
        ["bash", "-c", command],
        input=json.dumps({"tool_input": {"file_path": path}}),
        text=True,
        capture_output=True,
        check=True,
    )
    return result.stdout.strip()


@pytest.mark.parametrize(
    "path",
    (
        ".state/works/checkout-refunds/reviews/correctness.md",
        "/tmp/target/.state/works/checkout-refunds/reviews/quality.md",
    ),
)
def test_canonical_correctness_and_quality_artifacts_are_allowed(
    command: str, path: str
) -> None:
    assert run_hook(command, path) == ""


@pytest.mark.parametrize(
    "path",
    (
        ".state/works/checkout-refunds/reviews/security.md",
        ".state/works/checkout-refunds/extra/reviews/quality.md",
        "src/payment.ts",
    ),
)
def test_other_engineering_paths_remain_denied(command: str, path: str) -> None:
    output = json.loads(run_hook(command, path))
    assert output["hookSpecificOutput"]["permissionDecision"] == "deny"


@pytest.mark.parametrize(
    "path",
    (
        ".claude/agent-memory/code-quality-critic/MEMORY.md",
        "reports/report-quality.md",
        "notes/change.review.md",
    ),
)
def test_existing_safe_report_paths_stay_allowed(command: str, path: str) -> None:
    assert run_hook(command, path) == ""
