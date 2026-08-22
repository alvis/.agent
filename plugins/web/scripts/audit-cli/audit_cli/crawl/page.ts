import type { ActionLogger } from "../action_log";
import { BrowserDriverError, type BrowserDriver } from "../drive/browser";
import {
  type AuditServer,
  injectAndRun as run_injected_audit,
} from "../drive/inject";
import {
  DiscoverOptions,
  discoverHoverTargets,
  discoverInteractions,
} from "../discover/interactions";
import type { PageAuditResult } from "../types";
import { CrawlQueue, normalizeUrl } from "./queue";

const READY_EXPRESSION = "document.readyState === 'complete'";
const IDLE_WAIT_MS = 150;
const HOVER_SETTLE_MS = 200;
const UNHOVER_SETTLE_MS = 100;
const MODAL_SETTLE_MS = 300;

export type AuditScope = "quick" | "full";

export interface ViewportSpec {
  readonly label: string;
  readonly kind: string;
  readonly width: number;
  readonly height: number;
}

type AuditReport = Readonly<Record<string, unknown>>;
type AuditIssue = Record<string, unknown>;
type AuditRunner = typeof run_injected_audit;

/** Runs the baseline and interaction audit pipeline for every viewport. */
export async function auditPage(
  driver: BrowserDriver,
  server: AuditServer,
  queue: CrawlQueue,
  url: string,
  viewports: readonly ViewportSpec[],
  options: {
    readonly all_pages?: boolean;
    readonly same_origin_host?: string | null;
    readonly scope?: AuditScope;
    readonly logger?: ActionLogger | null;
    readonly audit_runner?: AuditRunner;
  } = {},
): Promise<PageAuditResult> {
  const allPages = options.all_pages ?? false;
  const sameOriginHost = options.same_origin_host ?? null;
  const scope = options.scope ?? "full";
  const logger = options.logger ?? null;
  const auditRunner = options.audit_runner ?? run_injected_audit;
  const result: PageAuditResult = {
    url,
    viewport_reports: {},
    anchor_urls: [],
    bonus_urls: [],
    triggered_reports: [],
    hover_findings: [],
    modal_findings: [],
  };
  const hoverIssues: AuditIssue[] = [];
  const modalIssues: AuditIssue[] = [];
  const navigationIssues: AuditIssue[] = [];

  log(logger, "page_start", {
    page: url,
    viewport_count: viewports.length,
    all_pages: allPages,
    scope,
  });

  for (const viewport of viewports) {
    log(logger, "viewport_start", {
      page: url,
      viewport: viewport.label,
      width: viewport.width,
      height: viewport.height,
    });
    driver.resize(viewport.width, viewport.height);
    driver.navigate(url);
    driver.wait_for_fn(READY_EXPRESSION, { timeout_ms: 5000 });

    result.viewport_reports[viewport.label] = await auditRunner(
      driver,
      server,
      {
        viewport_label: viewport.label,
        viewport_kind: viewport.kind,
      },
    );

    const anchors = collectAnchorHrefs(driver);
    result.anchor_urls.push(...anchors);
    log(logger, "anchors_collected", {
      page: url,
      viewport: viewport.label,
      count: anchors.length,
    });

    const snapshot = driver.snapshot();
    const plan = discoverInteractions(
      snapshot,
      new DiscoverOptions({
        all_pages: allPages,
        same_origin_host: sameOriginHost,
      }),
    );
    log(logger, "interactions_discovered", {
      page: url,
      viewport: viewport.label,
      count: plan.candidates.length,
      cross_origin_count: plan.cross_origin_candidates.length,
      dropped_social_count: plan.dropped_social.length,
    });

    for (const candidate of plan.candidates) {
      if (!queue.register_interaction(candidate.fingerprint)) {
        log(logger, "interaction_skipped", {
          page: url,
          viewport: viewport.label,
          uid: candidate.uid,
          fingerprint: candidate.fingerprint,
          reason: "already-visited",
        });
        continue;
      }
      const beforeUrl = driver.get_url();
      const preModalCount =
        scope === "quick" ? 0 : countVisibleModals(driver);

      try {
        log(logger, "interaction_trigger", {
          page: url,
          viewport: viewport.label,
          uid: candidate.uid,
          role: candidate.role,
          name: candidate.name,
          fingerprint: candidate.fingerprint,
        });
        driver.click(candidate.uid);
      } catch (error) {
        if (!(error instanceof BrowserDriverError)) throw error;
        log(logger, "interaction_error", {
          page: url,
          viewport: viewport.label,
          uid: candidate.uid,
          fingerprint: candidate.fingerprint,
          reason: "click-failed",
        });
        continue;
      }
      driver.wait_for_fn(READY_EXPRESSION, { timeout_ms: 3000 });
      driver.wait_for_fn(`Date.now() > ${IDLE_WAIT_MS}`, {
        timeout_ms: IDLE_WAIT_MS + 50,
      });

      const afterUrl = driver.get_url();
      if (normalizeUrl(afterUrl) !== normalizeUrl(beforeUrl)) {
        result.bonus_urls.push(afterUrl);
        log(logger, "interaction_navigated", {
          page: url,
          viewport: viewport.label,
          from_url: beforeUrl,
          to_url: afterUrl,
          uid: candidate.uid,
          fingerprint: candidate.fingerprint,
        });
        continue;
      }

      clearPointerHover(driver);
      result.triggered_reports.push([
        candidate.fingerprint,
        await auditRunner(driver, server, {
          viewport_label: viewport.label,
          viewport_kind: viewport.kind,
        }),
      ]);

      if (scope !== "quick") {
        const postModalCount = countVisibleModals(driver);
        if (postModalCount > preModalCount) {
          modalIssues.push(
            ...runModalAudit(driver, candidate.uid, candidate.name),
            ..._probe_modal_backdrop(driver, {
              selector_hint: `modal@e${candidate.uid}`,
            }),
            ...probeEscapeDismissal(driver, {
              selector_hint: `modal@e${candidate.uid}`,
            }),
          );
        }
      }
      dismiss(driver);
    }

    if (scope !== "quick") {
      hoverIssues.push(
        ...runHoverPass(driver, discoverHoverTargets(snapshot)),
      );
    }
    navigationIssues.push(
      ..._probe_home_logo_behavior(driver, {
        current_url: url,
        selector_hint: "header-home-link",
      }),
    );
    log(logger, "viewport_finish", {
      page: url,
      viewport: viewport.label,
      hover_issue_count: hoverIssues.length,
      modal_issue_count: modalIssues.length,
      navigation_issue_count: navigationIssues.length,
      bonus_url_count: result.bonus_urls.length,
    });
  }

  if (hoverIssues.length > 0)
    mergeIssuesIntoReports(
      result.viewport_reports,
      "interaction",
      hoverIssues,
    );
  if (modalIssues.length > 0)
    mergeIssuesIntoReports(
      result.viewport_reports,
      "interaction",
      modalIssues,
    );
  if (navigationIssues.length > 0)
    mergeIssuesIntoReports(
      result.viewport_reports,
      "interaction",
      navigationIssues,
    );

  result.hover_findings = hoverIssues;
  result.modal_findings = modalIssues;
  log(logger, "page_finish", {
    page: url,
    anchor_count: result.anchor_urls.length,
    bonus_url_count: result.bonus_urls.length,
    hover_issue_count: hoverIssues.length,
    modal_issue_count: modalIssues.length,
    navigation_issue_count: navigationIssues.length,
  });
  return result;
}

function log(
  logger: ActionLogger | null,
  event: string,
  fields: Readonly<Record<string, unknown>>,
): void {
  logger?.log(event, fields);
}

function collectAnchorHrefs(driver: BrowserDriver): string[] {
  const expression =
    "JSON.stringify(Array.from(document.querySelectorAll('a[href]'))" +
    ".map(a => a.href).filter(h => h && !h.startsWith('javascript:') && !h.startsWith('mailto:')))";
  const parsed = parseEvalJson(driver.evaluate(expression).stdout);
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}

const HOVER_STYLE_KEYS = [
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
] as const;

function hoverCaptureExpression(uid: number): string {
  return (
    "JSON.stringify((function(){" +
    `var el = window.__axRefs && window.__axRefs['e${uid}'];` +
    `if (!el) { el = document.querySelector('[data-ab-ref="e${uid}"]'); }` +
    "if (!el) return null;" +
    "var cs = getComputedStyle(el);var out = {};" +
    `var keys = ${JSON.stringify(HOVER_STYLE_KEYS)};` +
    "for (var i = 0; i < keys.length; i++) { out[keys[i]] = cs[keys[i]]; }" +
    "return out;})())"
  );
}

function parseEvalJson(raw: string): unknown {
  const outer = parseJson(raw);
  if (!Array.isArray(outer) || outer.length === 0 || !isRecord(outer[0]))
    return outer;
  const first = outer[0];
  if (isRecord(first.result)) return parseNestedJson(first.result.result);
  return typeof first.data === "string" ? parseJson(first.data) : outer;
}

function runHoverPass(
  driver: BrowserDriver,
  targets: readonly number[],
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  for (const uid of targets) {
    const before = parseEvalJson(
      driver.evaluate(hoverCaptureExpression(uid)).stdout,
    );
    if (!isRecord(before)) continue;
    try {
      driver.hover(uid);
    } catch (error) {
      if (!(error instanceof BrowserDriverError)) throw error;
      continue;
    }
    sleep(HOVER_SETTLE_MS);
    const after = parseEvalJson(
      driver.evaluate(hoverCaptureExpression(uid)).stdout,
    );
    try {
      driver.hover("body");
    } catch (error) {
      if (!(error instanceof BrowserDriverError)) throw error;
    }
    sleep(UNHOVER_SETTLE_MS);
    if (!isRecord(after)) continue;

    const changedKeys = HOVER_STYLE_KEYS.filter(
      (key) => before[key] !== after[key],
    );
    if (changedKeys.length > 0) continue;
    const selectorHint = `@e${uid}`;
    issues.push({
      category: "interaction",
      ruleId: "DES-STAT-01",
      desRuleId: "DES-STAT-01",
      severity: "medium",
      title: "Interactive element lacks hover feedback",
      summary: `${selectorHint} did not change any of ${HOVER_STYLE_KEYS.length} tracked computed styles on :hover.`,
      details:
        "Interactive elements must visually respond to pointer hover so users can confirm affordance. Add a :hover rule that shifts color, background, outline, shadow, or transform.",
      selector: selectorHint,
      tags: ["hover", "feedback", "state"],
      wcagCriteria: [],
      evidence: { uid, observedKeys: [...HOVER_STYLE_KEYS] },
    });
  }
  return issues;
}

function clearPointerHover(driver: BrowserDriver): void {
  try {
    driver.hover("body");
  } catch (error) {
    if (!(error instanceof BrowserDriverError)) throw error;
    return;
  }
  sleep(UNHOVER_SETTLE_MS);
}

function countVisibleModals(driver: BrowserDriver): number {
  const expression =
    "JSON.stringify(Array.from(document.querySelectorAll(" +
    '\'[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open]\'' +
    ")).filter(function(el){return el.offsetParent !== null;}).length)";
  const parsed = parseEvalJson(driver.evaluate(expression).stdout);
  if (typeof parsed === "number" && Number.isInteger(parsed)) return parsed;
  if (typeof parsed !== "string") return 0;
  const count = Number.parseInt(parsed, 10);
  return Number.isNaN(count) ? 0 : count;
}

function runModalAudit(
  driver: BrowserDriver,
  triggerUid: number,
  triggerName: string,
): AuditIssue[] {
  const parsed = parseEvalJson(
    driver.evaluate("JSON.stringify(window.runModalAudit({modalUids: []}))")
      .stdout,
  );
  if (!isRecord(parsed) || !Array.isArray(parsed.issues)) return [];
  const enriched: AuditIssue[] = [];
  for (const issue of parsed.issues) {
    if (!isRecord(issue)) continue;
    const evidence = isRecord(issue.evidence) ? { ...issue.evidence } : {};
    enriched.push({
      ...issue,
      evidence: { ...evidence, triggerUid, triggerName },
    });
  }
  return enriched;
}

function probeEscapeDismissal(
  driver: BrowserDriver,
  options: { readonly selector_hint: string },
): AuditIssue[] {
  try {
    driver.press("Escape");
  } catch (error) {
    if (!(error instanceof BrowserDriverError)) throw error;
  }
  sleep(MODAL_SETTLE_MS);
  if (countVisibleModals(driver) === 0) return [];
  return [
    {
      category: "interaction",
      ruleId: "DES-MODA-03",
      desRuleId: "DES-MODA-03",
      severity: "high",
      title: "Modal does not dismiss on Escape",
      summary: `${options.selector_hint} remained visible after pressing Escape — keyboard users cannot dismiss the dialog.`,
      details:
        "Dialogs must close on the Escape key so keyboard-only users can exit without hunting for a close button.",
      selector: options.selector_hint,
      tags: ["modal", "keyboard", "dismissal"],
      wcagCriteria: ["2.1.1", "2.1.2"],
      evidence: {},
    },
  ];
}

export function _probe_modal_backdrop(
  driver: BrowserDriver,
  options: { readonly selector_hint: string },
): AuditIssue[] {
  const expression =
    "JSON.stringify((function(){" +
    'var selector = \'[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open]\';' +
    "function isVisible(el){if (!el || el.offsetParent === null) return false;var style = getComputedStyle(el);if (style.display === 'none' || style.visibility === 'hidden') return false;return parseFloat(style.opacity || '1') > 0;}" +
    "function zIndex(el){var raw = getComputedStyle(el).zIndex || '0';var parsed = parseFloat(raw);return Number.isFinite(parsed) ? parsed : 0;}" +
    "var viewportArea = Math.max(window.innerWidth * window.innerHeight, 1);" +
    "var modals = Array.from(document.querySelectorAll(selector)).filter(isVisible);" +
    "if (modals.length === 0) return true;var all = Array.from(document.body.querySelectorAll('*'));" +
    "return modals.every(function(modal){var modalZ = zIndex(modal);return all.some(function(candidate){" +
    "if (candidate === modal || modal.contains(candidate) || candidate.contains(modal)) return false;if (!isVisible(candidate)) return false;" +
    "var style = getComputedStyle(candidate);if (style.position !== 'fixed' && style.position !== 'absolute') return false;" +
    "var blur = style.backdropFilter || style.webkitBackdropFilter || 'none';var markedBlur = candidate.getAttribute('data-modal-backdrop') === 'blur';" +
    "if ((!blur || blur === 'none') && !markedBlur) return false;var rect = candidate.getBoundingClientRect();" +
    "var area = Math.max(rect.width, 0) * Math.max(rect.height, 0);if (area < viewportArea * 0.35) return false;return zIndex(candidate) <= modalZ;});});})())";
  if (parseEvalJson(driver.evaluate(expression).stdout) === true) return [];
  return [
    {
      category: "interaction",
      ruleId: "DES-MODA-04",
      desRuleId: "DES-MODA-04",
      severity: "medium",
      title: "Modal lacks backdrop blur",
      summary: `${options.selector_hint} opened without a backdrop blur layer — background content still competes with the active modal.`,
      details:
        "When a modal or menu sheet opens, add a fixed backdrop layer with a subtle tint and backdrop-filter blur(...) so the rest of the page recedes behind the active surface.",
      selector: options.selector_hint,
      tags: ["modal", "backdrop", "focus"],
      wcagCriteria: [],
      evidence: {},
    },
  ];
}

export function _probe_home_logo_behavior(
  driver: BrowserDriver,
  options: { readonly current_url: string; readonly selector_hint: string },
): AuditIssue[] {
  const rootUrl = new URL("/", options.current_url).toString();
  const homeSelector =
    `header a[href="/"], header a[href="${rootUrl}"], ` +
    `[role="banner"] a[href="/"], [role="banner"] a[href="${rootUrl}"]`;
  const existsExpression =
    "JSON.stringify((function(){" +
    `return Boolean(document.querySelector(${JSON.stringify(homeSelector)}));` +
    "})())";
  if (parseEvalJson(driver.evaluate(existsExpression).stdout) !== true)
    return [];

  if (new URL(options.current_url).pathname === "/") {
    const scrolled = parseEvalJson(
      driver.evaluate(
        "JSON.stringify((function(){window.scrollTo(0, Math.max(window.innerHeight * 1.25, 720));return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;})())",
      ).stdout,
    );
    if (scrolled !== true && (typeof scrolled !== "number" || scrolled < 120))
      return [];
  }

  const clicked = parseEvalJson(
    driver.evaluate(
      "JSON.stringify((function(){" +
        `var link = document.querySelector(${JSON.stringify(homeSelector)});` +
        "if (!link) return false;link.click();return true;})())",
    ).stdout,
  );
  if (clicked !== true) return [];

  try {
    driver.wait_for_fn("window.location.pathname === '/'", {
      timeout_ms: 3000,
    });
    driver.wait_for_fn(
      "(window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0) <= 8",
      { timeout_ms: 3000 },
    );
  } catch (error) {
    if (!(error instanceof BrowserDriverError)) throw error;
    return [
      {
        category: "interaction",
        ruleId: "DES-NAVI-04",
        desRuleId: "DES-NAVI-04",
        severity: "medium",
        title: "Home logo does not return users to the top",
        summary: `${options.selector_hint} did not land on the root page at the top of the viewport after activation.`,
        details:
          "Clicking the home logo should take users to `/` and reset scroll position to the top so the brand mark behaves like a dependable home anchor.",
        selector: options.selector_hint,
        tags: ["navigation", "logo", "home"],
        wcagCriteria: [],
        evidence: { url: options.current_url },
      },
    ];
  }
  return [];
}

function mergeIssuesIntoReports(
  viewportReports: Record<string, AuditReport>,
  categoryKey: string,
  issues: readonly AuditIssue[],
): void {
  for (const [label, report] of Object.entries(viewportReports)) {
    const writable = { ...report };
    const categories = isRecord(writable.categories)
      ? { ...writable.categories }
      : {};
    const category = isRecord(categories[categoryKey])
      ? { ...categories[categoryKey] }
      : { issues: [] };
    category.issues = [
      ...(Array.isArray(category.issues) ? category.issues : []),
      ...issues,
    ];
    categories[categoryKey] = category;
    writable.categories = categories;
    viewportReports[label] = writable;
  }
}

function dismiss(driver: BrowserDriver): void {
  try {
    driver.press("Escape");
  } catch (error) {
    if (!(error instanceof BrowserDriverError)) throw error;
  }
  sleep(MODAL_SETTLE_MS);
  if (countVisibleModals(driver) === 0) return;
  const closeScript =
    "(function(){var modals = document.querySelectorAll(" +
    '\'[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open]\'' +
    ");for (var i = 0; i < modals.length; i++) {if (modals[i].offsetParent === null) continue;" +
    'var btns = modals[i].querySelectorAll(\'button, [role="button"], a[href], [tabindex]:not([tabindex="-1"])\');' +
    "for (var j = 0; j < btns.length; j++) {var b = btns[j];var aria = (b.getAttribute('aria-label') || '').trim();" +
    "var text = (b.textContent || '').trim();if (/close|dismiss/i.test(aria) || /^\\s*(close|dismiss|\\u00d7|x)\\s*$/i.test(text) ||" +
    "b.hasAttribute('data-dismiss') || b.hasAttribute('data-close')) {b.click();return true;}}}return false;})()";
  try {
    driver.evaluate(closeScript);
  } catch (error) {
    if (!(error instanceof BrowserDriverError)) throw error;
  }
  sleep(MODAL_SETTLE_MS);
  if (countVisibleModals(driver) === 0) return;
  try {
    driver.reload();
    driver.wait_for_fn(READY_EXPRESSION, { timeout_ms: 3000 });
  } catch (error) {
    if (!(error instanceof BrowserDriverError)) throw error;
  }
}

function sleep(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function parseJson(value: string): unknown {
  if (value.trim().length === 0) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function parseNestedJson(value: unknown): unknown {
  return typeof value === "string" ? parseJson(value) : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
