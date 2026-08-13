import json
import subprocess
import time
from pathlib import Path

import pytest

ESSENTIAL = Path(__file__).resolve().parents[1]
LEASE = ESSENTIAL / "scripts/state-lease"
STATE_WRITE = ESSENTIAL / "scripts/state-write"


class StateWriteHarness:
    """A scratch work directory plus lease/state-write invocation helpers."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.work_dir = root / "works" / "demo"
        (self.work_dir / "state").mkdir(parents=True)
        self.lease_path = self.work_dir / "lease.json"

    def acquire(self, *arguments: str) -> str:
        completed = subprocess.run(
            [
                str(LEASE),
                "acquire",
                "--work-dir",
                str(self.work_dir),
                "--capability",
                "pm",
                "--session",
                "s1",
                *arguments,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(completed.stdout)["token"]

    def write(
        self, token: str, target: str, content: str = "content\n"
    ) -> tuple[int, dict]:
        completed = subprocess.run(
            [
                str(STATE_WRITE),
                "--work-dir",
                str(self.work_dir),
                "--token",
                token,
                "--target",
                target,
            ],
            input=content,
            capture_output=True,
            text=True,
            check=False,
        )
        return completed.returncode, json.loads(completed.stdout)


@pytest.fixture
def harness(tmp_path: Path) -> StateWriteHarness:
    return StateWriteHarness(tmp_path)


def test_write_applies_content_and_heartbeats(harness: StateWriteHarness) -> None:
    token = harness.acquire()
    before = json.loads(harness.lease_path.read_text(encoding="utf-8"))
    time.sleep(1.1)
    code, payload = harness.write(token, "state.md", "fresh state\n")
    assert code == 0, payload
    assert payload["status"] == "written"
    assert (harness.work_dir / "state.md").read_text(
        encoding="utf-8"
    ) == "fresh state\n"
    after = json.loads(harness.lease_path.read_text(encoding="utf-8"))
    assert after["expires_at_epoch"] > before["expires_at_epoch"]
    assert after["acquired_at"] == before["acquired_at"]


def test_write_creates_nested_target(harness: StateWriteHarness) -> None:
    token = harness.acquire()
    code, _payload = harness.write(token, "state/journal.md", "line\n")
    assert code == 0
    assert (harness.work_dir / "state/journal.md").is_file()


def test_refuses_without_lease(harness: StateWriteHarness) -> None:
    code, payload = harness.write("anything", "state.md")
    assert code == 4
    assert payload["status"] == "lease_free"
    assert not (harness.work_dir / "state.md").exists()


def test_refuses_expired_lease(harness: StateWriteHarness) -> None:
    token = harness.acquire("--ttl", "1")
    time.sleep(2)
    code, payload = harness.write(token, "state.md")
    assert code == 4
    assert payload["status"] == "lease_expired"


def test_refuses_foreign_token(harness: StateWriteHarness) -> None:
    harness.acquire()
    code, payload = harness.write("deadbeef", "state.md")
    assert code == 5
    assert payload["status"] == "lease_foreign"
    assert not (harness.work_dir / "state.md").exists()


@pytest.mark.parametrize(
    "target", ("../escape.md", "/etc/escape.md", "state/../../up.md")
)
def test_refuses_traversal_and_absolute_targets(
    harness: StateWriteHarness, target: str
) -> None:
    token = harness.acquire()
    code, payload = harness.write(token, target)
    assert code == 2, target
    assert payload["status"] == "invalid"


def test_refuses_symlinked_target(harness: StateWriteHarness) -> None:
    token = harness.acquire()
    victim = harness.root / "victim.md"
    victim.write_text("original", encoding="utf-8")
    (harness.work_dir / "state.md").symlink_to(victim)
    code, _payload = harness.write(token, "state.md")
    assert code == 2
    assert victim.read_text(encoding="utf-8") == "original"


def test_no_temp_files_left_behind(harness: StateWriteHarness) -> None:
    token = harness.acquire()
    harness.write(token, "state.md")
    harness.write("wrong", "state.md")
    leftovers = [
        name
        for name in (entry.name for entry in harness.work_dir.iterdir())
        if name.startswith(".state-write.")
    ]
    assert leftovers == []
