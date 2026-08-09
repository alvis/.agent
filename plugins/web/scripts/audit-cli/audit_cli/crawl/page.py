"""Per-page audit orchestrator — runs baseline + interaction sweeps."""

from __future__ import annotations

import json
import time
import urllib.parse
from dataclasses import dataclass
from typing import Literal, Mapping

from audit_cli.action_log import ActionLogger
from audit_cli.crawl.queue import CrawlQueue, normalize_url
from audit_cli.discover.interactions import (
    DiscoverOptions,
    discover_hover_targets,
    discover_interactions,
)
from audit_cli.drive.browser import BrowserDriver, BrowserDriverError
from audit_cli.drive.inject import AuditServer, inject_and_run
from audit_cli.types import PageAuditResult

_READY_EXPRESSION = "document.readyState === 'complete'"
_IDLE_WAIT_MS = 150
_HOVER_SETTLE_MS = 200
_UNHOVER_SETTLE_MS = 100
_MODAL_SETTLE_MS = 300

AuditScope = Literal["quick", "full"]


@dataclass(frozen=True)
class ViewportSpec:
    """Device label + pixel dimensions for a single audit viewport."""

    label: str
    kind: str
    width: int
    height: int


def audit_page(
    driver: BrowserDriver,
    server: AuditServer,
    queue: CrawlQueue,
    url: str,
    viewports: tuple[ViewportSpec, ...],
    *,
    all_pages: bool = False,
    same_origin_host: str | None = None,
    scope: AuditScope = "full",
    logger: ActionLogger | None = None,
) -> PageAuditResult:
    """Run the full per-page pipeline for each viewport.

    The pipeline:
      1. Resize to the viewport, navigate, wait for readiness.
      2. Inject scripts, run the baseline audit.
      3. Discover interactions, exercise each new fingerprint
         (wrapping each click in modal-appearance detection).
      4. Run the hover pass (skipped when ``scope='quick'``).
      5. Collect anchor hrefs; split same- vs cross-origin.
    """
    result = PageAuditResult(url=url)
    hover_issues: list[dict[str, object]] = []
    modal_issues: list[dict[str, object]] = []
    navigation_issues: list[dict[str, object]] = []
    _log(
        logger,
        "page_start",
        page=url,
        viewport_count=len(viewports),
        all_pages=all_pages,
        scope=scope,
    )

    for viewport in viewports:
        _log(
            logger,
            "viewport_start",
            page=url,
            viewport=viewport.label,
            width=viewport.width,
            height=viewport.height,
        )
        driver.resize(viewport.width, viewport.height)
        driver.navigate(url)
        driver.wait_for_fn(_READY_EXPRESSION, timeout_ms=5000)

        baseline = inject_and_run(
            driver,
            server,
            viewport_label=viewport.label,
            viewport_kind=viewport.kind,
        )
        result.viewport_reports[viewport.label] = baseline

        anchors = _collect_anchor_hrefs(driver)
        result.anchor_urls.extend(anchors)
        _log(
            logger,
            "anchors_collected",
            page=url,
            viewport=viewport.label,
            count=len(anchors),
        )

        snapshot = driver.snapshot()
        plan = discover_interactions(
            snapshot,
            DiscoverOptions(all_pages=all_pages, same_origin_host=same_origin_host),
        )
        _log(
            logger,
            "interactions_discovered",
            page=url,
            viewport=viewport.label,
            count=len(plan.candidates),
            cross_origin_count=len(plan.cross_origin_candidates),
            dropped_social_count=len(plan.dropped_social),
        )
        for candidate in plan.candidates:
            if not queue.register_interaction(candidate.fingerprint):
                _log(
                    logger,
                    "interaction_skipped",
                    page=url,
                    viewport=viewport.label,
                    uid=candidate.uid,
                    fingerprint=candidate.fingerprint,
                    reason="already-visited",
                )
                continue
            before_url = driver.get_url()

            # Modal pre-click snapshot — skip in quick scope to save time.
            pre_modal_count = (
                0 if scope == "quick" else _count_visible_modals(driver)
            )

            try:
                _log(
                    logger,
                    "interaction_trigger",
                    page=url,
                    viewport=viewport.label,
                    uid=candidate.uid,
                    role=candidate.role,
                    name=candidate.name,
                    fingerprint=candidate.fingerprint,
                )
                driver.click(candidate.uid)
            except BrowserDriverError:
                _log(
                    logger,
                    "interaction_error",
                    page=url,
                    viewport=viewport.label,
                    uid=candidate.uid,
                    fingerprint=candidate.fingerprint,
                    reason="click-failed",
                )
                continue
            driver.wait_for_fn(_READY_EXPRESSION, timeout_ms=3000)
            driver.wait_for_fn(f"Date.now() > {_IDLE_WAIT_MS}", timeout_ms=_IDLE_WAIT_MS + 50)

            after_url = driver.get_url()
            if normalize_url(after_url) != normalize_url(before_url):
                result.bonus_urls.append(after_url)
                _log(
                    logger,
                    "interaction_navigated",
                    page=url,
                    viewport=viewport.label,
                    from_url=before_url,
                    to_url=after_url,
                    uid=candidate.uid,
                    fingerprint=candidate.fingerprint,
                )
                continue

            _clear_pointer_hover(driver)
            follow_up = inject_and_run(
                driver,
                server,
                viewport_label=viewport.label,
                viewport_kind=viewport.kind,
            )
            result.triggered_reports.append((candidate.fingerprint, follow_up))

            if scope != "quick":
                post_modal_count = _count_visible_modals(driver)
                if post_modal_count > pre_modal_count:
                    modal_issues.extend(
                        _run_modal_audit(driver, candidate.uid, candidate.name)
                    )
                    modal_issues.extend(
                        _probe_modal_backdrop(
                            driver, selector_hint=f"modal@e{candidate.uid}"
                        )
                    )
                    modal_issues.extend(
                        _probe_escape_dismissal(
                            driver, selector_hint=f"modal@e{candidate.uid}"
                        )
                    )

            _dismiss(driver)

        if scope != "quick":
            hover_issues.extend(
                _run_hover_pass(driver, discover_hover_targets(snapshot))
            )
        navigation_issues.extend(
            _probe_home_logo_behavior(
                driver,
                current_url=url,
                selector_hint="header-home-link",
            )
        )
        _log(
            logger,
            "viewport_finish",
            page=url,
            viewport=viewport.label,
            hover_issue_count=len(hover_issues),
            modal_issue_count=len(modal_issues),
            navigation_issue_count=len(navigation_issues),
            bonus_url_count=len(result.bonus_urls),
        )

    if hover_issues:
        _merge_issues_into_reports(result.viewport_reports, "interaction", hover_issues)
    if modal_issues:
        _merge_issues_into_reports(
            result.viewport_reports, "interaction", modal_issues
        )
    if navigation_issues:
        _merge_issues_into_reports(
            result.viewport_reports, "interaction", navigation_issues
        )

    result.hover_findings = tuple(hover_issues)
    result.modal_findings = tuple(modal_issues)
    _log(
        logger,
        "page_finish",
        page=url,
        anchor_count=len(result.anchor_urls),
        bonus_url_count=len(result.bonus_urls),
        hover_issue_count=len(hover_issues),
        modal_issue_count=len(modal_issues),
        navigation_issue_count=len(navigation_issues),
    )
    return result


def _log(logger: ActionLogger | None, event: str, **fields: object) -> None:
    if logger is None:
        return
    logger.log(event, **fields)


def _collect_anchor_hrefs(driver: BrowserDriver) -> list[str]:
    expression = (
        "JSON.stringify(Array.from(document.querySelectorAll('a[href]'))"
        ".map(a => a.href).filter(h => h && !h.startsWith('javascript:') && !h.startsWith('mailto:')))"
    )
    raw = driver.evaluate(expression).stdout.strip()
    if not raw:
        return []

    try:
        outer = json.loads(raw)
    except json.JSONDecodeError:
        return []

    # Unwrap agent-browser batch --json envelope: [{"result": {"result": "..."}, ...}]
    inner_str: object = outer
    if isinstance(outer, list) and outer and isinstance(outer[0], dict):
        first = outer[0]
        if "result" in first and "success" in first:
            inner_str = first.get("result", {})
            if isinstance(inner_str, dict):
                inner_str = inner_str.get("result", "[]")
        elif "data" in first:
            inner_str = first["data"]

    if isinstance(inner_str, str):
        try:
            inner_str = json.loads(inner_str)
        except json.JSONDecodeError:
            return []

    if isinstance(inner_str, list):
        return [str(item) for item in inner_str if isinstance(item, str)]
    return []


_HOVER_STYLE_KEYS: tuple[str, ...] = (
    "color",
    "backgroundColor",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "outlineColor",
    "outlineWidth",
    "outlineOffset",
    "boxShadow",
    "textDecorationLine",
    "textDecorationColor",
    "textDecorationThickness",
    "transform",
    "opacity",
    "filter",
    "fontWeight",
    "letterSpacing",
    "cursor",
)


def _hover_capture_expression(uid: int) -> str:
    keys_js = json.dumps(list(_HOVER_STYLE_KEYS))
    return (
        "JSON.stringify((function(){"
        f"var el = window.__axRefs && window.__axRefs['e{uid}'];"
        f"if (!el) {{ el = document.querySelector('[data-ab-ref=\"e{uid}\"]'); }}"
        "if (!el) return null;"
        "var cs = getComputedStyle(el);"
        "var out = {};"
        f"var keys = {keys_js};"
        "for (var i = 0; i < keys.length; i++) { out[keys[i]] = cs[keys[i]]; }"
        "return out;"
        "})())"
    )


def _parse_eval_json(raw: str) -> object:
    stripped = raw.strip()
    if not stripped:
        return None
    try:
        outer = json.loads(stripped)
    except json.JSONDecodeError:
        return None
    # agent-browser batch --json envelope shape:
    # [{"result": {"origin": "...", "result": "<json-string>"}, ...}]
    if isinstance(outer, list) and outer and isinstance(outer[0], dict):
        first = outer[0]
        inner = first.get("result")
        if isinstance(inner, dict):
            value = inner.get("result")
            if isinstance(value, str):
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    return value
            return value
        if "data" in first and isinstance(first["data"], str):
            try:
                return json.loads(first["data"])
            except json.JSONDecodeError:
                return None
    return outer


def _run_hover_pass(
    driver: BrowserDriver, targets: tuple[int, ...]
) -> list[dict[str, object]]:
    issues: list[dict[str, object]] = []
    for uid in targets:
        before_raw = driver.evaluate(_hover_capture_expression(uid)).stdout
        before = _parse_eval_json(before_raw)
        if not isinstance(before, dict):
            continue
        try:
            driver.hover(uid)
        except BrowserDriverError:
            continue
        time.sleep(_HOVER_SETTLE_MS / 1000)
        after = _parse_eval_json(driver.evaluate(_hover_capture_expression(uid)).stdout)
        try:
            driver.hover("body")
        except BrowserDriverError:
            pass
        time.sleep(_UNHOVER_SETTLE_MS / 1000)

        if not isinstance(after, dict):
            continue

        changed_keys = tuple(
            key for key in _HOVER_STYLE_KEYS if before.get(key) != after.get(key)
        )
        if changed_keys:
            continue

        selector_hint = f"@e{uid}"
        issues.append(
            {
                "category": "interaction",
                "ruleId": "DES-STAT-01",
                "desRuleId": "DES-STAT-01",
                "severity": "medium",
                "title": "Interactive element lacks hover feedback",
                "summary": (
                    f"{selector_hint} did not change any of {len(_HOVER_STYLE_KEYS)} "
                    "tracked computed styles on :hover."
                ),
                "details": (
                    "Interactive elements must visually respond to pointer hover "
                    "so users can confirm affordance. Add a :hover rule that "
                    "shifts color, background, outline, shadow, or transform."
                ),
                "selector": selector_hint,
                "tags": ["hover", "feedback", "state"],
                "wcagCriteria": [],
                "evidence": {
                    "uid": uid,
                    "observedKeys": list(_HOVER_STYLE_KEYS),
                },
            }
        )
    return issues


def _clear_pointer_hover(driver: BrowserDriver) -> None:
    try:
        driver.hover("body")
    except BrowserDriverError:
        return
    time.sleep(_UNHOVER_SETTLE_MS / 1000)


def _count_visible_modals(driver: BrowserDriver) -> int:
    expression = (
        "JSON.stringify(Array.from(document.querySelectorAll("
        "'[role=\"dialog\"], [role=\"alertdialog\"], [aria-modal=\"true\"], dialog[open]'"
        ")).filter(function(el){return el.offsetParent !== null;}).length)"
    )
    parsed = _parse_eval_json(driver.evaluate(expression).stdout)
    if isinstance(parsed, int):
        return parsed
    if isinstance(parsed, str):
        try:
            return int(parsed)
        except ValueError:
            return 0
    return 0


def _run_modal_audit(
    driver: BrowserDriver, trigger_uid: int, trigger_name: str
) -> list[dict[str, object]]:
    expression = "JSON.stringify(window.runModalAudit({modalUids: []}))"
    parsed = _parse_eval_json(driver.evaluate(expression).stdout)
    if not isinstance(parsed, dict):
        return []
    raw_issues = parsed.get("issues")
    if not isinstance(raw_issues, list):
        return []
    enriched: list[dict[str, object]] = []
    for issue in raw_issues:
        if not isinstance(issue, dict):
            continue
        copy: dict[str, object] = dict(issue)
        evidence = copy.get("evidence")
        if not isinstance(evidence, dict):
            evidence = {}
        evidence["triggerUid"] = trigger_uid
        evidence["triggerName"] = trigger_name
        copy["evidence"] = evidence
        enriched.append(copy)
    return enriched


def _probe_escape_dismissal(
    driver: BrowserDriver, *, selector_hint: str
) -> list[dict[str, object]]:
    try:
        driver.press("Escape")
    except BrowserDriverError:
        pass
    time.sleep(_MODAL_SETTLE_MS / 1000)
    if _count_visible_modals(driver) == 0:
        return []
    return [
        {
            "category": "interaction",
            "ruleId": "DES-MODA-03",
            "desRuleId": "DES-MODA-03",
            "severity": "high",
            "title": "Modal does not dismiss on Escape",
            "summary": (
                f"{selector_hint} remained visible after pressing Escape — "
                "keyboard users cannot dismiss the dialog."
            ),
            "details": (
                "Dialogs must close on the Escape key so keyboard-only users "
                "can exit without hunting for a close button."
            ),
            "selector": selector_hint,
            "tags": ["modal", "keyboard", "dismissal"],
            "wcagCriteria": ["2.1.1", "2.1.2"],
            "evidence": {},
        }
    ]


def _probe_modal_backdrop(
    driver: BrowserDriver, *, selector_hint: str
) -> list[dict[str, object]]:
    expression = (
        "JSON.stringify((function(){"
        "var selector = '[role=\"dialog\"], [role=\"alertdialog\"], [aria-modal=\"true\"], dialog[open]';"
        "function isVisible(el){"
        "  if (!el || el.offsetParent === null) return false;"
        "  var style = getComputedStyle(el);"
        "  if (style.display === 'none' || style.visibility === 'hidden') return false;"
        "  return parseFloat(style.opacity || '1') > 0;"
        "}"
        "function zIndex(el){"
        "  var raw = getComputedStyle(el).zIndex || '0';"
        "  var parsed = parseFloat(raw);"
        "  return Number.isFinite(parsed) ? parsed : 0;"
        "}"
        "var viewportArea = Math.max(window.innerWidth * window.innerHeight, 1);"
        "var modals = Array.from(document.querySelectorAll(selector)).filter(isVisible);"
        "if (modals.length === 0) return true;"
        "var all = Array.from(document.body.querySelectorAll('*'));"
        "return modals.every(function(modal){"
        "  var modalZ = zIndex(modal);"
        "  return all.some(function(candidate){"
        "    if (candidate === modal || modal.contains(candidate) || candidate.contains(modal)) return false;"
        "    if (!isVisible(candidate)) return false;"
        "    var style = getComputedStyle(candidate);"
        "    if (style.position !== 'fixed' && style.position !== 'absolute') return false;"
        "    var blur = style.backdropFilter || style.webkitBackdropFilter || 'none';"
        "    var markedBlur = candidate.getAttribute('data-modal-backdrop') === 'blur';"
        "    if ((!blur || blur === 'none') && !markedBlur) return false;"
        "    var rect = candidate.getBoundingClientRect();"
        "    var area = Math.max(rect.width, 0) * Math.max(rect.height, 0);"
        "    if (area < viewportArea * 0.35) return false;"
        "    return zIndex(candidate) <= modalZ;"
        "  });"
        "});"
        "})())"
    )
    parsed = _parse_eval_json(driver.evaluate(expression).stdout)
    if parsed is True:
        return []
    return [
        {
            "category": "interaction",
            "ruleId": "DES-MODA-04",
            "desRuleId": "DES-MODA-04",
            "severity": "medium",
            "title": "Modal lacks backdrop blur",
            "summary": (
                f"{selector_hint} opened without a backdrop blur layer — "
                "background content still competes with the active modal."
            ),
            "details": (
                "When a modal or menu sheet opens, add a fixed backdrop layer "
                "with a subtle tint and backdrop-filter blur(...) so the rest "
                "of the page recedes behind the active surface."
            ),
            "selector": selector_hint,
            "tags": ["modal", "backdrop", "focus"],
            "wcagCriteria": [],
            "evidence": {},
        }
    ]


def _probe_home_logo_behavior(
    driver: BrowserDriver,
    *,
    current_url: str,
    selector_hint: str,
) -> list[dict[str, object]]:
    home_selector = (
        'header a[href="/"], header a[href="' + urllib.parse.urljoin(current_url, "/") + '"], '
        '[role="banner"] a[href="/"], [role="banner"] a[href="' + urllib.parse.urljoin(current_url, "/") + '"]'
    )
    exists_expression = (
        "JSON.stringify((function(){"
        f"return Boolean(document.querySelector({json.dumps(home_selector)}));"
        "})())"
    )
    if _parse_eval_json(driver.evaluate(exists_expression).stdout) is not True:
        return []

    path = urllib.parse.urlparse(current_url).path or "/"
    if path == "/":
        scrolled_expression = (
            "JSON.stringify((function(){"
            "window.scrollTo(0, Math.max(window.innerHeight * 1.25, 720));"
            "return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;"
            "})())"
        )
        scrolled = _parse_eval_json(driver.evaluate(scrolled_expression).stdout)
        if not isinstance(scrolled, (int, float)) or scrolled < 120:
            return []

    click_expression = (
        "JSON.stringify((function(){"
        f"var link = document.querySelector({json.dumps(home_selector)});"
        "if (!link) return false;"
        "link.click();"
        "return true;"
        "})())"
    )
    clicked = _parse_eval_json(driver.evaluate(click_expression).stdout)
    if clicked is not True:
        return []

    try:
        driver.wait_for_fn("window.location.pathname === '/'", timeout_ms=3000)
        driver.wait_for_fn(
            "(window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0) <= 8",
            timeout_ms=3000,
        )
    except BrowserDriverError:
        return [
            {
                "category": "interaction",
                "ruleId": "DES-NAVI-04",
                "desRuleId": "DES-NAVI-04",
                "severity": "medium",
                "title": "Home logo does not return users to the top",
                "summary": (
                    f"{selector_hint} did not land on the root page at the top of the viewport "
                    "after activation."
                ),
                "details": (
                    "Clicking the home logo should take users to `/` and reset scroll position "
                    "to the top so the brand mark behaves like a dependable home anchor."
                ),
                "selector": selector_hint,
                "tags": ["navigation", "logo", "home"],
                "wcagCriteria": [],
                "evidence": {"url": current_url},
            }
        ]

    return []


def _merge_issues_into_reports(
    viewport_reports: dict[str, Mapping[str, object]],
    category_key: str,
    issues: list[dict[str, object]],
) -> None:
    # Inject synthetic issues into every viewport's report so they flow
    # through the existing aggregation + dedup pipeline unchanged.
    for label, report in list(viewport_reports.items()):
        if not isinstance(report, dict):
            continue
        writable: dict[str, object] = dict(report)
        categories_raw = writable.get("categories")
        categories: dict[str, object] = (
            dict(categories_raw) if isinstance(categories_raw, dict) else {}
        )
        category_raw = categories.get(category_key)
        category: dict[str, object] = (
            dict(category_raw) if isinstance(category_raw, dict) else {"issues": []}
        )
        existing = category.get("issues")
        merged = list(existing) if isinstance(existing, list) else []
        merged.extend(issues)
        category["issues"] = merged
        categories[category_key] = category
        writable["categories"] = categories
        viewport_reports[label] = writable


def _dismiss(driver: BrowserDriver) -> None:
    try:
        driver.press("Escape")
    except BrowserDriverError:
        pass
    time.sleep(_MODAL_SETTLE_MS / 1000)
    if _count_visible_modals(driver) == 0:
        return
    # Escape failed — try clicking a detected close affordance via JS.
    close_script = (
        "(function(){"
        "var modals = document.querySelectorAll("
        "'[role=\"dialog\"], [role=\"alertdialog\"], [aria-modal=\"true\"], dialog[open]'"
        ");"
        "for (var i = 0; i < modals.length; i++) {"
        "  if (modals[i].offsetParent === null) continue;"
        "  var btns = modals[i].querySelectorAll("
        "    'button, [role=\"button\"], a[href], [tabindex]:not([tabindex=\"-1\"])'"
        "  );"
        "  for (var j = 0; j < btns.length; j++) {"
        "    var b = btns[j];"
        "    var aria = (b.getAttribute('aria-label') || '').trim();"
        "    var text = (b.textContent || '').trim();"
        "    if (/close|dismiss/i.test(aria) || /^\\s*(close|dismiss|\\u00d7|x)\\s*$/i.test(text) ||"
        "        b.hasAttribute('data-dismiss') || b.hasAttribute('data-close')) {"
        "      b.click();"
        "      return true;"
        "    }"
        "  }"
        "}"
        "return false;"
        "})()"
    )
    try:
        driver.evaluate(close_script)
    except BrowserDriverError:
        pass
    time.sleep(_MODAL_SETTLE_MS / 1000)
    if _count_visible_modals(driver) == 0:
        return
    # Last-resort fallback: reload the page.
    try:
        driver.reload()
        driver.wait_for_fn(_READY_EXPRESSION, timeout_ms=3000)
    except BrowserDriverError:
        pass
