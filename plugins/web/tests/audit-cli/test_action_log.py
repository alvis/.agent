"""Verify audit action logging for browser commands and page events."""

import json
import subprocess
from pathlib import Path
from typing import Sequence

import pytest

from audit_cli.action_log import ActionLogger
from audit_cli.drive.browser import BrowserDriver


class _CompletedStub:
    def __init__(self, stdout: str = "", stderr: str = "", returncode: int = 0) -> None:
        self.stdout = stdout
        self.stderr = stderr
        self.returncode = returncode


def test_action_logger_writes_jsonl_entries(tmp_path: Path) -> None:
    log_path = tmp_path / "action-log.jsonl"
    logger = ActionLogger(log_path)

    logger.log("page_start", page="https://example.com", viewport="desktop")
    logger.log("page_finish", page="https://example.com", issues=2)

    entries = [
        json.loads(line)
        for line in log_path.read_text(encoding="utf-8").splitlines()
    ]
    assert [
        (entry["event"], entry.get("page"), entry.get("issues"))
        for entry in entries
    ] == [
        ("page_start", "https://example.com", None),
        ("page_finish", "https://example.com", 2),
    ]


def test_browser_driver_logs_successful_action(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    log_path = tmp_path / "action-log.jsonl"

    def fake_run(cmd: Sequence[str], **kwargs: object) -> _CompletedStub:
        return _CompletedStub(stdout='[{"result":{"url":"https://example.com"},"success":true}]')

    monkeypatch.setattr(subprocess, "run", fake_run)

    driver = BrowserDriver(logger=ActionLogger(log_path))
    driver.navigate("https://example.com")

    entries = [json.loads(line) for line in log_path.read_text(encoding="utf-8").splitlines()]
    assert {
        key: entries[-1][key]
        for key in ("event", "action", "success")
    } == {"event": "browser_action", "action": "open", "success": True}
