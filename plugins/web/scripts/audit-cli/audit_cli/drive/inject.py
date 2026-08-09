"""Serve audit scripts over localhost and inject them into the browser.

Spins up a ThreadingHTTPServer rooted at the shared ``scripts/`` directory,
waits for it to be ready, then asks the BrowserDriver to load each audit
script as ``<script src="...">`` — dodging the 35KB evaluate_script
payload ceiling mentioned in the agent memory.
"""

from __future__ import annotations

import contextlib
import http.server
import json
import socket
import socketserver
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Mapping

from audit_cli.drive.browser import BrowserDriver, BrowserDriverError

_SCRIPT_ORDER: tuple[str, ...] = (
    "wcag-text-audit.js",
    "semantic-structure-audit.js",
    "interaction-audit.js",
    "mobile-layout-audit.js",
    "visual-layout-audit.js",
    "design-tokens-audit.js",
    "typography-audit.js",
    "spatial-layout-audit.js",
    "unused-css-audit.js",
    "modal-audit.js",
    "design-audit-aggregator.js",
)

_PORT_RANGE_START = 18977
_PORT_RANGE_COUNT = 40


@dataclass(frozen=True)
class AuditServer:
    """Handle for the background audit-script HTTP server."""

    host: str
    port: int
    scripts_dir: Path


class _ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


@contextlib.contextmanager
def serve_audit_scripts(scripts_dir: Path) -> Iterator[AuditServer]:
    """Yield a running HTTP server that exposes ``scripts_dir`` over HTTP."""
    handler = _handler_factory(scripts_dir)
    port = _find_open_port()
    server = _ThreadingServer(("127.0.0.1", port), handler)
    thread = threading.Thread(target=server.serve_forever, name="audit-script-server", daemon=True)
    thread.start()
    try:
        yield AuditServer(host="127.0.0.1", port=port, scripts_dir=scripts_dir)
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2.0)


def inject_and_run(
    driver: BrowserDriver,
    server: AuditServer,
    *,
    viewport_label: str,
    viewport_kind: str,
) -> Mapping[str, object]:
    """Inject every audit script, execute the aggregator, return its JSON."""
    base_url = f"http://{server.host}:{server.port}"
    for script_name in _SCRIPT_ORDER:
        driver.evaluate(_inject_script_snippet(f"{base_url}/{script_name}"))
        driver.wait_for_fn(_script_ready_expression(script_name), timeout_ms=2000)

    driver.wait_for_fn("typeof window.runDesignAudit === 'function'", timeout_ms=2000)
    options_payload = json.dumps({"viewport": viewport_kind, "viewportLabel": viewport_label})
    result = driver.evaluate(f"JSON.stringify(window.runDesignAudit({options_payload}))")
    parsed = _parse_eval_payload(result.stdout)
    if isinstance(parsed, dict):
        return parsed
    raise BrowserDriverError("runDesignAudit did not return an object")


def _inject_script_snippet(url: str) -> str:
    return (
        "new Promise((resolve, reject) => {"
        "const s = document.createElement('script');"
        f"s.src = {json.dumps(url)};"
        "s.onload = () => resolve(true);"
        "s.onerror = (e) => reject(e);"
        "document.head.appendChild(s);"
        "})"
    )


def _script_ready_expression(script_name: str) -> str:
    token = script_name.replace(".js", "")
    global_map = {
        "wcag-text-audit": "runWcagTextAudit",
        "semantic-structure-audit": "runSemanticStructureAudit",
        "interaction-audit": "runInteractionAudit",
        "mobile-layout-audit": "runMobileLayoutAudit",
        "visual-layout-audit": "runVisualLayoutAudit",
        "design-tokens-audit": "runDesignTokensAudit",
        "typography-audit": "runTypographyAudit",
        "spatial-layout-audit": "runSpatialLayoutAudit",
        "unused-css-audit": "runUnusedCssAudit",
        "modal-audit": "runModalAudit",
        "design-audit-aggregator": "runDesignAudit",
    }
    global_name = global_map.get(token, "")
    if not global_name:
        return "true"
    return f"typeof window.{global_name} === 'function'"


def _parse_eval_payload(raw: str) -> object:
    """Parse the stdout from ``agent-browser batch --json`` eval command.

    The batch response has the shape::

        [{"command": [...], "result": {"origin": "...", "result": <value>},
          "error": null, "success": true}]

    The actual JavaScript return value lives at ``[0]["result"]["result"]``.
    When the JS expression returns a JSON string (e.g. ``JSON.stringify(...)``),
    we parse that string a second time to get the object.
    """
    stripped = raw.strip()
    if not stripped:
        return None
    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        return None
    # Unwrap agent-browser batch --json envelope: [{..., "result": {"result": ...}, ...}]
    if isinstance(parsed, list) and parsed:
        first = parsed[0]
        if isinstance(first, dict):
            inner = first.get("result")
            if isinstance(inner, dict):
                value = inner.get("result")
                if isinstance(value, str):
                    try:
                        return json.loads(value)
                    except json.JSONDecodeError:
                        return value
                return value
    # Fallback: already a plain value or legacy "data" envelope
    if isinstance(parsed, list) and parsed:
        first = parsed[0]
        if isinstance(first, dict) and "data" in first and isinstance(first["data"], str):
            try:
                return json.loads(first["data"])
            except json.JSONDecodeError:
                return None
    if isinstance(parsed, str):
        try:
            return json.loads(parsed)
        except json.JSONDecodeError:
            return None
    return parsed


def _handler_factory(scripts_dir: Path) -> type[http.server.SimpleHTTPRequestHandler]:
    directory = str(scripts_dir)

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args: object, **kwargs: object) -> None:
            super().__init__(*args, directory=directory, **kwargs)  # type: ignore[arg-type]

        def log_message(self, format: str, *args: object) -> None:  # noqa: A002
            return

    return Handler


def _find_open_port() -> int:
    for candidate in range(_PORT_RANGE_START, _PORT_RANGE_START + _PORT_RANGE_COUNT):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            try:
                probe.bind(("127.0.0.1", candidate))
            except OSError:
                continue
            return candidate
    raise RuntimeError("no free port available in the configured range")
