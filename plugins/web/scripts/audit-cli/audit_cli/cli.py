"""Argparse-powered entry point for ``python3 -m audit_cli``."""

from __future__ import annotations

import argparse
import datetime as _dt
import subprocess
import sys
import urllib.parse
from pathlib import Path
from typing import Literal, Sequence

from audit_cli.action_log import ActionLogger
from audit_cli.crawl.page import ViewportSpec, audit_page
from audit_cli.crawl.queue import CrawlQueue, normalize_url
from audit_cli.discover.routes import discover_source_routes
from audit_cli.discover.sitemap import fetch_sitemap_urls
from audit_cli.drive.browser import BrowserDriver, BrowserDriverError
from audit_cli.drive.inject import serve_audit_scripts
from audit_cli.report.aggregate import aggregate_report
from audit_cli.report.emit import write_report
from audit_cli.report.flag_ai import FlagContext, build_finding_from_issue, flag_finding
from audit_cli.types import Finding, Page, Report, Viewport

DEFAULT_VIEWPORTS: tuple[ViewportSpec, ...] = (
    ViewportSpec(label="Mobile 390x844", kind="mobile", width=390, height=844),
    ViewportSpec(label="Tablet 820x1180", kind="tablet", width=820, height=1180),
    ViewportSpec(label="Desktop 1440x900", kind="desktop", width=1440, height=900),
    ViewportSpec(label="Wide 1920x1080", kind="wide", width=1920, height=1080),
)

_SCRIPTS_DIR = Path(__file__).resolve().parents[3] / "skills/audit/scripts"

_AGENT_BROWSER_INSTALL_HINT = (
    "error: agent-browser is not installed or not on PATH.\n"
    "Install the latest release (macOS): brew install agent-browser\n"
    "See https://agent-browser.dev for other platforms."
)


def _check_agent_browser(binary: str = "agent-browser") -> None:
    """Abort startup when ``agent-browser`` is missing.

    Runs ``agent-browser --version`` and exits non-zero with a pointer to
    the install instructions if the binary cannot be found or fails.
    """
    try:
        completed = subprocess.run(
            [binary, "--version"],
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        print(_AGENT_BROWSER_INSTALL_HINT, file=sys.stderr)
        raise SystemExit(2)
    if completed.returncode != 0:
        print(_AGENT_BROWSER_INSTALL_HINT, file=sys.stderr)
        raise SystemExit(2)


def main(argv: list[str] | None = None) -> int:
    """Dispatch CLI arguments; return process exit status."""
    _check_agent_browser()
    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.command == "audit":
        return _run_audit(args)

    parser.print_help(sys.stderr)
    return 2


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="audit_cli", description="Site audit orchestrator.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    audit = subparsers.add_parser("audit", help="Run an audit crawl against a target URL.")
    audit.add_argument("target", help="Seed URL to audit (e.g. https://example.com).")
    audit.add_argument(
        "--project", help="Local project path for source-route discovery.", default=None
    )
    audit.add_argument("--out", help="Output directory for report.json.", default=".audit-out")
    audit.add_argument(
        "--max-pages", type=int, default=25, help="Upper bound on pages to crawl."
    )
    audit.add_argument(
        "--all-pages",
        action="store_true",
        help="Exercise link-role interactions in addition to navigation.",
    )
    audit.add_argument(
        "--seeds",
        nargs="*",
        default=(),
        help="Extra seed URLs or concrete dynamic-route paths.",
    )
    audit.add_argument(
        "--viewport",
        choices=("mobile", "tablet", "desktop", "wide", "all"),
        default="all",
        help="Single viewport to audit; ``all`` runs every default viewport.",
    )
    audit.add_argument(
        "--dry-run",
        action="store_true",
        help="Resolve routes/queue without launching the browser.",
    )
    audit.add_argument(
        "--cdp-url",
        default=None,
        help=(
            "Attach to an existing agent-browser session via its CDP URL "
            "(from `agent-browser get cdp-url`). When set, the CLI will not "
            "call `agent-browser open` and will not close the session on exit."
        ),
    )

    return parser


def _run_audit(args: argparse.Namespace) -> int:
    target = normalize_url(args.target)
    if not target:
        print(f"error: invalid target URL: {args.target}", file=sys.stderr)
        return 2

    origin_parsed = urllib.parse.urlparse(target)
    origin = f"{origin_parsed.scheme}://{origin_parsed.netloc}"
    queue = CrawlQueue(origin=origin)
    queue.enqueue(target)
    source_routes = discover_source_routes(args.project) if args.project else []

    if source_routes:
        for route in source_routes:
            queue.enqueue(urllib.parse.urljoin(target, route.path))

    sitemap = fetch_sitemap_urls(target)
    for sitemap_url in sitemap.urls:
        queue.enqueue(sitemap_url)
    for seed in args.seeds:
        queue.enqueue(urllib.parse.urljoin(target, seed))

    out_dir = Path(args.out).resolve()
    logger = ActionLogger(out_dir / "action-log.jsonl")
    logger.log(
        "audit_start",
        target=target,
        project=args.project,
        max_pages=args.max_pages,
        all_pages=args.all_pages,
        viewport=args.viewport,
        seeds=list(args.seeds),
    )
    if source_routes:
        logger.log(
            "source_routes_discovered",
            count=len(source_routes),
            routes=[route.path for route in source_routes],
        )

    viewports = _select_viewports(args.viewport)
    if args.dry_run:
        logger.log("dry_run", queued=list(_peek_queue(queue)))
        dry_pages: tuple[Page, ...] = tuple(
            Page(url=entry_url, title=None, viewports=_viewports_from_specs(viewports), areas=(), findings=())
            for entry_url in list(queue.visited()) + list(_peek_queue(queue))
        )
        dry_report = _empty_report(target=target, origin=origin, pages=dry_pages)
        dry_path = write_report(dry_report, out_dir)
        logger.log("audit_finish", report=str(dry_path), page_count=len(dry_pages))
        print(str(dry_path))
        return 0

    pages: list[Page] = []
    findings_by_key: dict[tuple[str, str], Finding] = {}
    cross_origin: list[str] = []
    warnings: list[str] = list(sitemap.errors)

    with serve_audit_scripts(_SCRIPTS_DIR) as server, BrowserDriver(cdp_url=args.cdp_url, logger=logger) as driver:
        try:
            while queue.has_pending() and len(pages) < args.max_pages:
                url = queue.pop()
                if url is None:
                    break
                logger.log("queue_pop", url=url, visited_count=len(queue.visited()))
                result = audit_page(
                    driver,
                    server,
                    queue,
                    url,
                    viewports,
                    all_pages=args.all_pages,
                    same_origin_host=origin_parsed.netloc,
                    logger=logger,
                )
                anchor_added = queue.enqueue_many(result.anchor_urls)
                bonus_added = queue.enqueue_many(result.bonus_urls)
                logger.log(
                    "queue_extend",
                    url=url,
                    anchor_count=len(result.anchor_urls),
                    bonus_count=len(result.bonus_urls),
                    anchor_added=anchor_added,
                    bonus_added=bonus_added,
                )
                page_findings = _collect_page_findings(result)
                findings_by_key.update(page_findings)
                pages.append(
                    Page(
                        url=url,
                        title=None,
                        viewports=_viewports_from_specs(viewports),
                        areas=(),
                        findings=tuple(page_findings.values()),
                    )
                )
            cross_origin.extend(queue.cross_origin)
        except BrowserDriverError as exc:
            warnings.append(f"browser driver error: {exc}")
            logger.log("browser_driver_error", error=str(exc))

    aggregate = aggregate_report(
        {v.label: _viewport_payload(pages) for v in viewports}
    )

    report = Report(
        contract_version="3.0",
        target=target,
        generated_at=_dt.datetime.now(_dt.timezone.utc).isoformat(),
        overall_score=aggregate.overall_score,
        risk=_risk_literal(aggregate.risk),
        pages=tuple(pages),
        findings=tuple(findings_by_key.values()),
        recurring_elements=(),
        cross_origin_candidates=tuple(dict.fromkeys(cross_origin)),
        warnings=tuple(warnings),
    )
    _ = origin  # surfaced for dry-run narration; kept for future telemetry

    final_path = write_report(report, out_dir)
    logger.log(
        "audit_finish",
        report=str(final_path),
        page_count=len(pages),
        finding_count=len(findings_by_key),
        warning_count=len(warnings),
    )
    print(str(final_path))
    return 0


def _select_viewports(kind: str) -> tuple[ViewportSpec, ...]:
    if kind == "all":
        return DEFAULT_VIEWPORTS
    return tuple(v for v in DEFAULT_VIEWPORTS if v.kind == kind)


_VIEWPORT_LABELS: dict[str, Literal["mobile", "tablet", "desktop", "wide"]] = {
    "mobile": "mobile",
    "tablet": "tablet",
    "desktop": "desktop",
    "wide": "wide",
}


def _viewports_from_specs(specs: tuple[ViewportSpec, ...]) -> tuple[Viewport, ...]:
    return tuple(
        Viewport(
            label=_VIEWPORT_LABELS.get(spec.kind, "desktop"),
            width=spec.width,
            height=spec.height,
        )
        for spec in specs
    )


def _collect_page_findings(result: object) -> dict[tuple[str, str], Finding]:
    findings: dict[tuple[str, str], Finding] = {}
    for report in _iter_report_payloads(result):
        categories = report.get("categories") if isinstance(report, dict) else None
        if not isinstance(categories, dict):
            continue
        for cat_payload in categories.values():
            if not isinstance(cat_payload, dict):
                continue
            issues = cat_payload.get("issues")
            if not isinstance(issues, list):
                continue
            for issue in issues:
                if not isinstance(issue, dict):
                    continue
                finding = build_finding_from_issue(issue)
                context = FlagContext(
                    confidence=_extract_confidence(issue),
                    has_text_over_background_image=_detect_background_image(issue),
                )
                finding = flag_finding(finding, context)
                key = (finding.rule_id, finding.selector)
                findings[key] = finding
    return findings


def _iter_report_payloads(result: object) -> list[Mapping[str, object]]:
    payloads: list[Mapping[str, object]] = []

    viewport_reports = getattr(result, "viewport_reports", {})
    if isinstance(viewport_reports, dict):
        for report in viewport_reports.values():
            if isinstance(report, dict):
                payloads.append(report)

    triggered_reports = getattr(result, "triggered_reports", ())
    if isinstance(triggered_reports, list):
        for item in triggered_reports:
            if (
                isinstance(item, tuple)
                and len(item) == 2
                and isinstance(item[1], dict)
            ):
                payloads.append(item[1])

    return payloads


def _extract_confidence(issue: dict[str, object]) -> float | None:
    confidence = issue.get("confidence")
    if isinstance(confidence, (int, float)):
        return float(confidence)
    evidence = issue.get("evidence")
    if isinstance(evidence, dict):
        nested = evidence.get("confidence")
        if isinstance(nested, (int, float)):
            return float(nested)
    return None


def _detect_background_image(issue: dict[str, object]) -> bool:
    evidence = issue.get("evidence")
    if not isinstance(evidence, dict):
        return False
    flags = evidence.get("heuristics")
    if isinstance(flags, list) and "background-image-text" in flags:
        return True
    dom_value = evidence.get("domValue")
    if isinstance(dom_value, str) and "background-image" in dom_value and "color" in dom_value:
        return True
    return False


def _viewport_payload(pages: Sequence[Page]) -> dict[str, object]:
    issues: list[dict[str, object]] = []
    for page in pages:
        for finding in page.findings:
            issues.append(
                {
                    "ruleId": finding.rule_id,
                    "severity": _severity_back_to_js(finding.severity),
                    "selector": finding.selector,
                    "summary": finding.recommendation.action,
                    "category": "mixed",
                }
            )
    return {"categories": {"mixed": {"issues": issues}}}


def _severity_back_to_js(severity: str) -> str:
    mapping = {"p0": "critical", "p1": "high", "p2": "medium"}
    return mapping.get(severity, "medium")


def _risk_literal(risk: str) -> Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
    if risk == "CRITICAL":
        return "CRITICAL"
    if risk == "HIGH":
        return "HIGH"
    if risk == "MEDIUM":
        return "MEDIUM"
    return "LOW"


def _peek_queue(queue: CrawlQueue) -> list[str]:
    pending: list[str] = []
    while queue.has_pending():
        next_url = queue.pop()
        if next_url is not None:
            pending.append(next_url)
    return pending


def _empty_report(*, target: str, origin: str, pages: tuple[Page, ...]) -> Report:
    return Report(
        contract_version="3.0",
        target=target,
        generated_at=_dt.datetime.now(_dt.timezone.utc).isoformat(),
        overall_score=100,
        risk="LOW",
        pages=pages,
        findings=(),
        recurring_elements=(),
        cross_origin_candidates=(),
        warnings=(f"dry-run from {origin}",),
    )


if __name__ == "__main__":
    raise SystemExit(main())
