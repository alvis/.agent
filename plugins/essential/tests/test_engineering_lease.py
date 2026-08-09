from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

import pytest


ESSENTIAL = Path(__file__).resolve().parents[1]
LEASE = ESSENTIAL / "scripts/state-lease"
# pin macOS's system bash 3.2 rather than resolving the shebang against PATH,
# so its incident guards (e.g. `${2:-{\}}` keeping the backslash and feeding jq
# invalid JSON) stay exercised even when a newer Homebrew bash is on PATH
SYSTEM_BASH = "/bin/bash"


class LeaseHarness:
    """A scratch work directory plus lease invocation helpers."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.work_dir = root / "works" / "demo"
        self.work_dir.mkdir(parents=True)
        self.lease_path = self.work_dir / "lease.json"

    def run_lease(self, verb: str, *arguments: str) -> tuple[int, dict]:
        completed = subprocess.run(
            [SYSTEM_BASH, str(LEASE), verb,
             "--work-dir", str(self.work_dir), *arguments],
            capture_output=True,
            text=True,
        )
        payload = json.loads(completed.stdout)
        return completed.returncode, payload

    def acquire(self, session: str = "s1", *arguments: str) -> dict:
        code, payload = self.run_lease(
            "acquire", "--capability", "pm", "--session", session, *arguments
        )
        assert code == 0, payload
        assert payload["status"] == "acquired"
        return payload


@pytest.fixture
def lease(tmp_path: Path) -> LeaseHarness:
    return LeaseHarness(tmp_path)


def test_acquire_creates_well_formed_lease(lease: LeaseHarness) -> None:
    payload = lease.acquire()
    record = json.loads(lease.lease_path.read_text(encoding="utf-8"))
    for key in (
        "work_id",
        "owner_session",
        "owner_capability",
        "host",
        "pid",
        "token_sha256",
        "acquired_at",
        "acquired_epoch",
        "heartbeat_at",
        "expires_at",
        "expires_at_epoch",
        "ttl_seconds",
    ):
        assert key in record
    assert record["work_id"] == "demo"
    assert record["owner_session"] == "s1"
    assert record["owner_capability"] == "pm"
    assert "token" not in record  # digest only; plaintext never stored
    digest = hashlib.sha256(payload["token"].encode()).hexdigest()
    assert record["token_sha256"] == digest


def test_second_acquire_is_contended(lease: LeaseHarness) -> None:
    lease.acquire()
    code, payload = lease.run_lease(
        "acquire", "--capability", "pm", "--session", "s2"
    )
    assert code == 3
    assert payload["status"] == "contended"
    record = json.loads(lease.lease_path.read_text(encoding="utf-8"))
    assert record["owner_session"] == "s1"


def test_status_reports_free_held_foreign(lease: LeaseHarness) -> None:
    code, payload = lease.run_lease("status")
    assert payload["status"] == "free"
    token = lease.acquire()["token"]
    _, payload = lease.run_lease("status", "--token", token)
    assert payload["status"] == "held"
    _, payload = lease.run_lease("status", "--token", "deadbeef")
    assert payload["status"] == "foreign"
    _, payload = lease.run_lease("status")
    assert payload["status"] == "foreign"


def test_heartbeat_requires_matching_token(lease: LeaseHarness) -> None:
    token = lease.acquire()["token"]
    code, payload = lease.run_lease("heartbeat", "--token", "deadbeef")
    assert code == 5
    assert payload["status"] == "refused"
    code, payload = lease.run_lease(
        "heartbeat", "--token", token, "--state-revision", "7"
    )
    assert code == 0
    assert payload["status"] == "renewed"
    record = json.loads(lease.lease_path.read_text(encoding="utf-8"))
    assert record["state_revision"] == 7
    assert record["owner_session"] == "s1"


def test_release_requires_matching_token(lease: LeaseHarness) -> None:
    token = lease.acquire()["token"]
    code, payload = lease.run_lease("release", "--token", "deadbeef")
    assert code == 5
    assert payload["status"] == "refused"
    assert lease.lease_path.exists()
    code, payload = lease.run_lease("release", "--token", token)
    assert code == 0
    assert payload["status"] == "released"
    assert not lease.lease_path.exists()


def test_takeover_refused_on_live_lease(lease: LeaseHarness) -> None:
    lease.acquire()
    code, payload = lease.run_lease(
        "takeover", "--capability", "pm", "--session", "s2"
    )
    assert code == 5
    assert payload["status"] == "refused"
    record = json.loads(lease.lease_path.read_text(encoding="utf-8"))
    assert record["owner_session"] == "s1"


def test_takeover_succeeds_on_expired_lease(lease: LeaseHarness) -> None:
    lease.acquire("s1", "--ttl", "1")
    time.sleep(2)
    code, payload = lease.run_lease(
        "acquire", "--capability", "pm", "--session", "s2"
    )
    assert code == 4
    assert payload["status"] == "takeover_required"
    code, payload = lease.run_lease(
        "takeover", "--capability", "essential:takeover", "--session", "s2"
    )
    assert code == 0
    assert payload["status"] == "taken_over"
    assert payload["journal_event"] == "lease"
    assert payload["previous_lease"]["owner_session"] == "s1"
    record = json.loads(lease.lease_path.read_text(encoding="utf-8"))
    assert record["owner_session"] == "s2"
    assert record["owner_capability"] == "essential:takeover"


def test_symlinked_lease_path_refused(lease: LeaseHarness) -> None:
    victim = lease.root / "victim.json"
    victim.write_text("{}", encoding="utf-8")
    lease.lease_path.symlink_to(victim)
    code, payload = lease.run_lease("status")
    assert code == 2
    assert payload["status"] == "invalid"


def test_no_partial_files_left_behind(lease: LeaseHarness) -> None:
    token = lease.acquire()["token"]
    lease.run_lease("heartbeat", "--token", token)
    lease.run_lease("release", "--token", token)
    assert os.listdir(lease.work_dir) == []


def test_session_defaults_when_flag_absent(lease: LeaseHarness) -> None:
    completed = subprocess.run(
        [SYSTEM_BASH, str(LEASE), "acquire", "--work-dir", str(lease.work_dir),
         "--capability", "pm"],
        capture_output=True,
        text=True,
        env={**os.environ, "CLAUDE_SESSION_ID": "env-session"},
    )
    assert completed.returncode == 0, completed.stderr
    record = json.loads(lease.lease_path.read_text(encoding="utf-8"))
    assert record["owner_session"] == "env-session"


def test_session_falls_back_to_pid_identity(lease: LeaseHarness) -> None:
    env = {k: v for k, v in os.environ.items() if k != "CLAUDE_SESSION_ID"}
    completed = subprocess.run(
        [SYSTEM_BASH, str(LEASE), "acquire", "--work-dir", str(lease.work_dir),
         "--capability", "pm"],
        capture_output=True,
        text=True,
        env=env,
    )
    assert completed.returncode == 0, completed.stderr
    record = json.loads(lease.lease_path.read_text(encoding="utf-8"))
    assert record["owner_session"].startswith("pid-")


def test_heartbeat_preserves_acquired_at_without_date_parsing(
    lease: LeaseHarness,
) -> None:
    token = lease.acquire()["token"]
    before = json.loads(lease.lease_path.read_text(encoding="utf-8"))
    time.sleep(1.1)
    code, payload = lease.run_lease("heartbeat", "--token", token)
    assert code == 0
    after = json.loads(lease.lease_path.read_text(encoding="utf-8"))
    assert after["acquired_at"] == before["acquired_at"]
    assert after["acquired_epoch"] == before["acquired_epoch"]
    assert after["heartbeat_epoch"] >= before["heartbeat_epoch"]


def test_ensure_acquires_renews_and_refuses(lease: LeaseHarness) -> None:
    code, payload = lease.run_lease(
        "ensure", "--capability", "pm", "--session", "s1"
    )
    assert code == 0
    assert payload["status"] == "acquired"
    token = payload["token"]
    code, payload = lease.run_lease(
        "ensure", "--capability", "pm", "--token", token
    )
    assert code == 0
    assert payload["status"] == "renewed"
    code, payload = lease.run_lease("ensure", "--capability", "pm")
    assert code == 3
    assert payload["status"] == "contended"


def test_ensure_revives_own_expired_lease_only(lease: LeaseHarness) -> None:
    code, payload = lease.run_lease(
        "ensure", "--capability", "pm", "--session", "s1", "--ttl", "1"
    )
    token = payload["token"]
    time.sleep(2)
    code, payload = lease.run_lease("ensure", "--capability", "pm")
    assert code == 4
    assert payload["status"] == "takeover_required"
    code, payload = lease.run_lease(
        "ensure", "--capability", "pm", "--token", token
    )
    assert code == 0
    assert payload["status"] == "renewed"
