import os
import subprocess
import sys
from pathlib import Path

import pytest

PLUGIN = Path(__file__).resolve().parents[1]
SYNC_TOOL = PLUGIN / "skills" / "sync-tool" / "scripts" / "sync.py"


def run_jj_check(tmp_path: Path, version: str) -> subprocess.CompletedProcess[str]:
    executable = tmp_path / "jj"
    executable.write_text(f"#!/bin/sh\nprintf '%s\\n' 'jj {version}'\n")
    executable.chmod(0o755)
    return subprocess.run(
        [sys.executable, str(SYNC_TOOL), "--only=jj", "--check"],
        check=False,
        capture_output=True,
        text=True,
        env=os.environ | {"PATH": f"{tmp_path}:{os.environ['PATH']}"},
    )


@pytest.mark.parametrize(
    ("version", "expected_status"),
    [("0.43.0", 1), ("0.44.0", 0), ("0.45.0", 0)],
)
def test_jj_minimum_version_is_enforced(
    tmp_path: Path, version: str, expected_status: int
) -> None:
    completed = run_jj_check(tmp_path, version)

    assert completed.returncode == expected_status
    assert "0.44.0" in completed.stdout
