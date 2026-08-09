"""Verify BrowserDriver surfaces structured agent-browser batch errors."""

import subprocess
from typing import Sequence

import pytest

from audit_cli.drive.browser import BrowserDriver, BrowserDriverError


class _CompletedStub:
    """Minimal stand-in for ``subprocess.CompletedProcess`` used in tests."""

    def __init__(self, stdout: str = "", stderr: str = "", returncode: int = 0) -> None:
        self.stdout = stdout
        self.stderr = stderr
        self.returncode = returncode


def test_run_batch_uses_structured_stdout_error_when_stderr_is_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_run(cmd: Sequence[str], **kwargs: object) -> _CompletedStub:
        return _CompletedStub(
            stdout=(
                '[{"command":["connect","ws://127.0.0.1:9222"],'
                '"error":"CDP WebSocket connect failed: IO error: '
                'Connection refused (os error 61)","result":null,"success":false}]'
            ),
            stderr="",
            returncode=1,
        )

    monkeypatch.setattr(subprocess, "run", fake_run)

    driver = BrowserDriver()
    with pytest.raises(BrowserDriverError) as excinfo:
        driver._run_batch([["connect", "ws://127.0.0.1:9222"]])

    assert "CDP WebSocket connect failed" in str(excinfo.value)
    assert "<no error details>" not in str(excinfo.value)
