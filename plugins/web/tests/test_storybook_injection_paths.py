import os
import subprocess
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
STORYBOOK_SCRIPTS = PLUGIN_ROOT / "skills" / "storybook" / "scripts"


@pytest.fixture
def command_environment(tmp_path: Path) -> dict[str, str]:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()

    agent_browser = bin_dir / "agent-browser"
    agent_browser.write_text(
        """#!/usr/bin/env bash
set -euo pipefail
if [[ " $* " == *" eval "* ]]; then
  printf '%s\\n' '\"[]\"'
  exit 0
fi
payload="$(cat)"
if [[ "$payload" == *"__STORY_RENDERED__ === true"* ]]; then
  printf '%s\\n' '[{"result":true}]'
elif [[ "$payload" == *"matches_focus_visible"* ]]; then
  printf '%s\\n' '[{"result":{"matches_focus_visible":true}}]'
elif [[ "$payload" == *"available"* ]]; then
  printf '%s\\n' '[{"result":{"available":true}}]'
else
  printf '%s\\n' '[{"result":true}]'
fi
""",
        encoding="utf-8",
    )
    agent_browser.chmod(0o755)

    curl = bin_dir / "curl"
    curl.write_text("#!/usr/bin/env bash\nexit 1\n", encoding="utf-8")
    curl.chmod(0o755)

    return {
        **os.environ,
        "PATH": f"{bin_dir}{os.pathsep}{os.environ['PATH']}",
        "TMPDIR": str(tmp_path),
    }


@pytest.mark.parametrize(
    ("script_name", "arguments"),
    [
        ("list-stories.sh", ["--cdp", "9222", "--url", "http://storybook"]),
        (
            "capture-states.sh",
            ["--cdp", "9222", "--url", "http://storybook", "--story", "button"],
        ),
        (
            "scrape-panels.sh",
            ["--cdp", "9222", "--url", "http://storybook", "--story", "button"],
        ),
    ],
)
def test_storybook_script_resolves_plugin_injections(
    script_name: str,
    arguments: list[str],
    command_environment: dict[str, str],
    tmp_path: Path,
) -> None:
    completed = subprocess.run(
        [
            STORYBOOK_SCRIPTS / script_name,
            *arguments,
            "--run-dir",
            tmp_path / "run",
        ]
        if script_name != "list-stories.sh"
        else [STORYBOOK_SCRIPTS / script_name, *arguments],
        capture_output=True,
        check=False,
        cwd=tmp_path,
        env=command_environment,
        text=True,
        timeout=10,
    )

    assert (completed.returncode, "missing injection" in completed.stderr) == (
        0,
        False,
    ), completed.stderr


def test_storybook_skill_has_no_local_injections_directory() -> None:
    assert not (PLUGIN_ROOT / "skills" / "storybook" / "injections").exists()
