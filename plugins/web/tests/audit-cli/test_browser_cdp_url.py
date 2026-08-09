"""Verify BrowserDriver ownership semantics for external CDP sessions."""

import subprocess
from typing import Sequence

import pytest

from audit_cli.drive.browser import BrowserDriver


class _CompletedStub:
    """Minimal stand-in for ``subprocess.CompletedProcess`` used in tests."""

    def __init__(self, stdout: str = "", stderr: str = "", returncode: int = 0) -> None:
        self.stdout = stdout
        self.stderr = stderr
        self.returncode = returncode


def test_navigate_without_cdp_url_runs_open_and_marks_session_owned(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[list[str]] = []

    def fake_run(cmd: Sequence[str], **kwargs: object) -> _CompletedStub:
        calls.append(list(cmd))
        return _CompletedStub()

    monkeypatch.setattr(subprocess, "run", fake_run)

    with BrowserDriver() as driver:
        driver.navigate("https://example.com")
        assert driver.created_session is True

    # first subprocess invocation carries the batch "open" payload; last is "close"
    assert len(calls) == 2
    assert calls[0][0].endswith("agent-browser") or calls[0][0] == "agent-browser"
    assert "batch" in calls[0]


def test_navigate_with_cdp_url_does_not_open_or_close(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payloads: list[str] = []

    def fake_run(cmd: Sequence[str], **kwargs: object) -> _CompletedStub:
        stdin = kwargs.get("input")
        assert isinstance(stdin, str)
        payloads.append(stdin)
        return _CompletedStub()

    monkeypatch.setattr(subprocess, "run", fake_run)

    with BrowserDriver(cdp_url="http://127.0.0.1:9222") as driver:
        driver.navigate("https://example.com")
        assert driver.created_session is False

    # navigate issues exactly one batch (connect); close is suppressed
    assert len(payloads) == 1
    assert "connect" in payloads[0]
    assert "http://127.0.0.1:9222" in payloads[0]
    assert "open" not in payloads[0]
    assert "close" not in payloads[0]


def test_close_is_skipped_when_session_is_external(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[list[str]] = []

    def fake_run(cmd: Sequence[str], **kwargs: object) -> _CompletedStub:
        calls.append(list(cmd))
        return _CompletedStub()

    monkeypatch.setattr(subprocess, "run", fake_run)

    driver = BrowserDriver(cdp_url="http://127.0.0.1:9222")
    driver.close()

    assert calls == []
