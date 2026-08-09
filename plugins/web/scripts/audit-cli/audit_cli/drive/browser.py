"""Thin wrapper around the ``agent-browser`` CLI.

Probe result (2026-04-15): the installed ``agent-browser`` binary does not
expose a long-lived REPL. It does expose a ``batch`` sub-command that
accepts a JSON array of command arg-arrays on stdin and returns results as
a JSON array (with ``--json``). Every BrowserDriver method therefore spawns
one short-lived subprocess. Sessions persist across calls because
agent-browser stores browser state on disk by default; we rely on that.

If a future release ships a REPL mode, swap ``_run_batch`` with a
long-lived stdin pump.
"""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from types import TracebackType
from typing import Mapping, Sequence

from audit_cli.action_log import ActionLogger


@dataclass(frozen=True)
class BrowserResult:
    """Outcome of a single batched ``agent-browser`` invocation."""

    stdout: str
    stderr: str
    exit_code: int


class BrowserDriverError(RuntimeError):
    """Raised when ``agent-browser`` exits non-zero or is not installed."""


class BrowserDriver:
    """Context-managed façade over the ``agent-browser`` CLI."""

    def __init__(
        self,
        *,
        binary: str = "agent-browser",
        timeout: float = 30.0,
        cdp_url: str | None = None,
        logger: ActionLogger | None = None,
    ) -> None:
        self._binary = binary
        self._timeout = timeout
        self.cdp_url: str | None = cdp_url
        self.created_session: bool = False
        self._logger = logger

    def __enter__(self) -> "BrowserDriver":
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        self.close()

    def navigate(self, url: str) -> BrowserResult:
        """Open a URL in the current session.

        When ``cdp_url`` was supplied at construction time, attach to the
        externally-managed session via ``agent-browser connect <cdp_url>``
        instead of opening a new one. The caller retains ownership of that
        session and is responsible for closing it.
        """
        if self.cdp_url is not None:
            return self._run_batch([["connect", self.cdp_url]])
        result = self._run_batch([["open", url]])
        self.created_session = True
        return result

    def snapshot(self) -> Mapping[str, object]:
        """Return the AX snapshot as a parsed JSON mapping."""
        result = self._run_batch([["snapshot", "-i", "--json"]])
        parsed = _parse_single_json(result.stdout)
        if isinstance(parsed, dict):
            return parsed
        return {"nodes": []}

    def click(self, uid: int) -> BrowserResult:
        """Click an element by its AX uid (``@eN`` selector)."""
        return self._run_batch([["click", f"@e{uid}"]])

    def hover(self, target: int | str) -> BrowserResult:
        """Hover an element by AX uid (``int``) or raw selector (``str``).

        Accepts both shapes so callers can hover the ``<body>`` (for
        unhover) without a second method. Int uids are formatted as the
        ``@eN`` shorthand agent-browser expects.
        """
        selector = f"@e{target}" if isinstance(target, int) else target
        return self._run_batch([["hover", selector]])

    def wait_for_fn(self, expression: str, *, timeout_ms: int = 3000) -> BrowserResult:
        """Wait until the given JS expression evaluates truthy."""
        return self._run_batch(
            [["eval", f"new Promise(r=>{{let d=Date.now()+{timeout_ms};(function t(){{try{{if({expression})return r(true);}}catch(e){{}}if(Date.now()>d)return r(false);setTimeout(t,50);}})();}})"]]
        )

    def screenshot(self, path: str) -> BrowserResult:
        """Save a viewport-sized screenshot to ``path``."""
        return self._run_batch([["screenshot", path]])

    def evaluate(self, expression: str) -> BrowserResult:
        """Evaluate JavaScript in the current page context."""
        return self._run_batch([["eval", expression]])

    def resize(self, width: int, height: int) -> BrowserResult:
        """Resize the viewport."""
        return self._run_batch([["set", "viewport", str(width), str(height)]])

    def press(self, key: str) -> BrowserResult:
        """Press a single key (e.g. ``Escape``)."""
        return self._run_batch([["press", key]])

    def reload(self) -> BrowserResult:
        """Reload the current page."""
        return self._run_batch([["reload"]])

    def get_url(self) -> str:
        """Return the active page URL."""
        result = self._run_batch([["get", "url"]])
        parsed = _parse_single_json(result.stdout)
        # agent-browser get url → {"url": "..."}
        if isinstance(parsed, dict):
            url = parsed.get("url")
            if isinstance(url, str):
                return url
        return result.stdout.strip()

    def close(self) -> None:
        """Close the underlying browser session.

        Only closes sessions this driver opened itself. When attached to an
        externally-managed session (``cdp_url`` provided), leave it running
        for the caller.
        """
        if not self.created_session:
            return
        try:
            self._run_batch([["close"]])
        except BrowserDriverError:
            pass

    def _run_batch(self, commands: Sequence[Sequence[str]]) -> BrowserResult:
        payload = json.dumps(list(commands))
        try:
            completed = subprocess.run(
                [self._binary, "batch", "--bail", "--json"],
                input=payload,
                text=True,
                capture_output=True,
                timeout=self._timeout,
                check=False,
            )
        except FileNotFoundError as exc:
            self._log_action(commands, success=False, error=f"binary not found: {self._binary}")
            raise BrowserDriverError(
                f"agent-browser binary not found: {self._binary}"
            ) from exc
        except subprocess.TimeoutExpired as exc:
            self._log_action(
                commands,
                success=False,
                error=f"timed out after {self._timeout}s",
            )
            raise BrowserDriverError(
                f"agent-browser batch timed out after {self._timeout}s"
            ) from exc

        if completed.returncode != 0:
            detail = _extract_batch_error_detail(
                completed.stdout, completed.stderr
            )
            self._log_action(
                commands,
                success=False,
                error=detail,
                stdout=completed.stdout.strip() or None,
                stderr=completed.stderr.strip() or None,
            )
            raise BrowserDriverError(
                f"agent-browser exited {completed.returncode}: {detail}"
            )
        self._log_action(
            commands,
            success=True,
            stdout=completed.stdout.strip() or None,
            stderr=completed.stderr.strip() or None,
        )
        return BrowserResult(
            stdout=completed.stdout,
            stderr=completed.stderr,
            exit_code=completed.returncode,
        )

    def _log_action(
        self,
        commands: Sequence[Sequence[str]],
        *,
        success: bool,
        error: str | None = None,
        stdout: str | None = None,
        stderr: str | None = None,
    ) -> None:
        if self._logger is None:
            return
        action = commands[0][0] if commands and commands[0] else "unknown"
        self._logger.log(
            "browser_action",
            action=action,
            commands=[list(command) for command in commands],
            success=success,
            error=error,
            stdout=stdout,
            stderr=stderr,
            cdp_url=self.cdp_url,
        )


def _extract_batch_error_detail(stdout: str, stderr: str) -> str:
    """Return the most useful error detail from a failed batch invocation.

    ``agent-browser batch --json`` often reports command-level failures in the
    JSON envelope written to stdout while leaving stderr empty. Prefer that
    structured ``error`` field and fall back to stderr when needed.
    """
    details: list[str] = []

    structured_error = _extract_structured_batch_error(stdout)
    if structured_error:
        details.append(structured_error)

    stderr_detail = stderr.strip()
    if stderr_detail and stderr_detail not in details:
        details.append(stderr_detail)

    return " | ".join(details) if details else "<no error details>"


def _extract_structured_batch_error(stdout: str) -> str:
    """Extract the command-level ``error`` field from batch JSON stdout."""
    stripped = stdout.strip()
    if not stripped:
        return ""
    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        return ""
    if not isinstance(parsed, list):
        return ""
    errors: list[str] = []
    for entry in parsed:
        if not isinstance(entry, dict):
            continue
        error = entry.get("error")
        if isinstance(error, str) and error.strip():
            errors.append(error.strip())
    return " | ".join(errors)


def _parse_single_json(stdout: str) -> object:
    """Parse the stdout from a ``agent-browser batch --json`` command.

    The batch response has the shape::

        [{"command": [...], "result": <value>, "error": null, "success": true}]

    The actual result lives at ``[0]["result"]``.  Legacy envelopes with a
    ``"data"`` key are handled as a fallback.
    """
    stripped = stdout.strip()
    if not stripped:
        return None
    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        return None
    if isinstance(parsed, list) and parsed:
        first = parsed[0]
        if isinstance(first, dict):
            # agent-browser batch --json envelope: {"result": <value>, ...}
            if "result" in first and "success" in first:
                return first["result"]
            # Legacy "data" envelope
            if "data" in first:
                return first["data"]
        return first
    return parsed
