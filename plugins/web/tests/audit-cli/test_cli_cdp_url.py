"""Verify CLI plumbing for --cdp-url and the agent-browser preflight check."""

import subprocess
from typing import Sequence

import pytest

from audit_cli import cli as cli_module


class _CompletedStub:
    def __init__(self, returncode: int = 0, stdout: str = "", stderr: str = "") -> None:
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


def test_cdp_url_flag_is_parsed() -> None:
    parser = cli_module._build_parser()

    args = parser.parse_args(
        ["audit", "https://example.com", "--cdp-url", "http://127.0.0.1:9222"]
    )

    assert args.cdp_url == "http://127.0.0.1:9222"


def test_cdp_url_defaults_to_none() -> None:
    parser = cli_module._build_parser()

    args = parser.parse_args(["audit", "https://example.com"])

    assert args.cdp_url is None


def test_cdp_url_is_threaded_into_browser_driver(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    class _FakeDriver:
        def __init__(
            self,
            *,
            cdp_url: str | None = None,
            logger: object | None = None,
        ) -> None:
            captured["cdp_url"] = cdp_url

        def __enter__(self) -> "_FakeDriver":
            return self

        def __exit__(self, *exc: object) -> None:
            return None

    monkeypatch.setattr(cli_module, "BrowserDriver", _FakeDriver)
    monkeypatch.setattr(cli_module, "_check_agent_browser", lambda: None)

    # --dry-run shortcircuits the run before any BrowserDriver usage, so to
    # exercise the instantiation we call main() without --dry-run but mock
    # the crawl loop dependencies that would otherwise require a real browser.
    class _FakeServer:
        def __enter__(self) -> "_FakeServer":
            return self

        def __exit__(self, *exc: object) -> None:
            return None

    monkeypatch.setattr(cli_module, "serve_audit_scripts", lambda _dir: _FakeServer())

    def fake_audit_page(*args: object, **kwargs: object) -> object:
        class _Result:
            anchor_urls: tuple[str, ...] = ()
            bonus_urls: tuple[str, ...] = ()
            viewport_reports: dict[str, object] = {}

        return _Result()

    monkeypatch.setattr(cli_module, "audit_page", fake_audit_page)

    exit_code = cli_module.main(
        [
            "audit",
            "https://example.com",
            "--cdp-url",
            "http://127.0.0.1:9222",
            "--max-pages",
            "1",
            "--out",
            str(pytest.importorskip("tempfile").mkdtemp()),
        ]
    )

    assert exit_code == 0
    assert captured["cdp_url"] == "http://127.0.0.1:9222"


def test_check_agent_browser_exits_when_binary_missing(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    def fake_run(cmd: Sequence[str], **kwargs: object) -> _CompletedStub:
        raise FileNotFoundError("agent-browser")

    monkeypatch.setattr(subprocess, "run", fake_run)

    with pytest.raises(SystemExit) as excinfo:
        cli_module._check_agent_browser()

    assert excinfo.value.code == 2
    err = capsys.readouterr().err
    assert "agent-browser is not installed" in err
    assert "brew install agent-browser" in err


def test_check_agent_browser_exits_when_binary_returns_nonzero(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    def fake_run(cmd: Sequence[str], **kwargs: object) -> _CompletedStub:
        return _CompletedStub(returncode=127, stderr="boom")

    monkeypatch.setattr(subprocess, "run", fake_run)

    with pytest.raises(SystemExit) as excinfo:
        cli_module._check_agent_browser()

    assert excinfo.value.code == 2
    err = capsys.readouterr().err
    assert "brew install agent-browser" in err


def test_check_agent_browser_passes_when_binary_ok(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_run(cmd: Sequence[str], **kwargs: object) -> _CompletedStub:
        return _CompletedStub(returncode=0, stdout="agent-browser 1.2.3")

    monkeypatch.setattr(subprocess, "run", fake_run)

    cli_module._check_agent_browser()
