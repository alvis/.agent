#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ActionLogger } from "./action_log";
import { type ViewportSpec, auditPage } from "./crawl/page";
import { CrawlQueue, normalizeUrl } from "./crawl/queue";
import { discoverSourceRoutes } from "./discover/routes";
import { fetchSitemapUrls } from "./discover/sitemap";
import { BrowserDriver, BrowserDriverError } from "./drive/browser";
import { serveAuditScripts } from "./drive/inject";
import { aggregateReport } from "./report/aggregate";
import { writeReport } from "./report/emit";
import {
  buildFindingFromIssue,
  flagFinding,
  type FlagContext,
} from "./report/flag_ai";
import type {
  Finding,
  Page,
  PageAuditResult,
  Report,
  Viewport,
  ViewportLabel,
} from "./types";

export const DEFAULT_VIEWPORTS: readonly ViewportSpec[] = [
  { label: "Mobile 390x844", kind: "mobile", width: 390, height: 844 },
  { label: "Tablet 820x1180", kind: "tablet", width: 820, height: 1180 },
  { label: "Desktop 1440x900", kind: "desktop", width: 1440, height: 900 },
  { label: "Wide 1920x1080", kind: "wide", width: 1920, height: 1080 },
];

const SCRIPTS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../skills/audit/scripts",
);
const AGENT_BROWSER_INSTALL_HINT =
  "error: agent-browser is not installed or not on PATH.\n" +
  "Install the latest release (macOS): brew install agent-browser\n" +
  "See https://agent-browser.dev for other platforms.";
const VIEWPORT_KINDS = new Set(["mobile", "tablet", "desktop", "wide", "all"]);

export interface AuditArguments {
  readonly command: "audit";
  readonly target: string;
  readonly project: string | null;
  readonly out: string;
  readonly maxPages: number;
  readonly all_pages: boolean;
  readonly seeds: readonly string[];
  readonly viewport: string;
  readonly dry_run: boolean;
  readonly cdp_url: string | null;
}

export class CliExit extends Error {
  readonly exitCode: number;

  constructor(exitCode: number, message = "") {
    super(message);
    this.name = "CliExit";
    this.exitCode = exitCode;
  }
}

export interface CliParser {
  parseArgs(argv: readonly string[]): AuditArguments;
  print_help(): void;
}

/** Verifies that the configured agent-browser executable can start. */
export function checkAgentBrowser(binary = "agent-browser"): void {
  let completed: ReturnType<typeof spawnSync>;
  try {
    completed = spawnSync(binary, ["--version"], {
      encoding: "utf8",
    });
  } catch {
    console.error(AGENT_BROWSER_INSTALL_HINT);
    throw new CliExit(2, AGENT_BROWSER_INSTALL_HINT);
  }
  if (completed.error !== undefined || completed.status !== 0) {
    console.error(AGENT_BROWSER_INSTALL_HINT);
    throw new CliExit(2, AGENT_BROWSER_INSTALL_HINT);
  }
}

/** Dispatches CLI arguments and returns the process exit status. */
export async function main(
  argv: readonly string[] = Bun.argv.slice(2),
): Promise<number> {
  checkAgentBrowser();
  const parser = buildParser();
  let args: AuditArguments;
  try {
    args = parser.parseArgs(argv);
  } catch (error) {
    if (error instanceof CliExit) {
      if (error.message) console.error(error.message);
      return error.exitCode;
    }
    throw error;
  }
  return runAudit(args);
}

/** Builds the importable parser used by the executable and tests. */
export function buildParser(): CliParser {
  return {
    parseArgs: parseArguments,
    print_help: () => console.error(helpText()),
  };
}

/** Runs one audit command. */
export async function runAudit(args: AuditArguments): Promise<number> {
  const target = normalizeUrl(args.target);
  if (!target) {
    console.error(`error: invalid target URL: ${args.target}`);
    return 2;
  }

  const targetUrl = new URL(target);
  const origin = targetUrl.origin;
  const queue = new CrawlQueue({ origin });
  queue.enqueue(target);
  const sourceRoutes = args.project ? discoverSourceRoutes(args.project) : [];
  for (const route of sourceRoutes)
    queue.enqueue(new URL(route.path, target).toString());

  const sitemap = await fetchSitemapUrls(target);
  queue.enqueue_many(sitemap.urls);
  for (const seed of args.seeds)
    queue.enqueue(new URL(seed, target).toString());

  const outDir = resolve(args.out);
  const logger = new ActionLogger(resolve(outDir, "action-log.jsonl"));
  logger.log("audit_start", {
    target,
    project: args.project,
    maxPages: args.maxPages,
    all_pages: args.all_pages,
    viewport: args.viewport,
    seeds: [...args.seeds],
  });
  if (sourceRoutes.length > 0) {
    logger.log("source_routes_discovered", {
      count: sourceRoutes.length,
      routes: sourceRoutes.map((route) => route.path),
    });
  }

  const viewports = selectViewports(args.viewport);
  if (args.dry_run) {
    const queued = peekQueue(queue);
    logger.log("dry_run", { queued });
    const pages = queued.map((url): Page => ({
      url,
      title: null,
      viewports: viewportsFromSpecs(viewports),
      areas: [],
      findings: [],
    }));
    const report = emptyReport({ target, origin, pages });
    const reportPath = writeReport(report, outDir);
    logger.log("audit_finish", {
      report: reportPath,
      page_count: pages.length,
    });
    console.log(reportPath);
    return 0;
  }

  const pages: Page[] = [];
  const findingsByKey = new Map<string, Finding>();
  const warnings = [...sitemap.errors];
  const server = await serveAuditScripts(SCRIPTS_DIR);
  const driver = new BrowserDriver({
    cdp_url: args.cdp_url ?? undefined,
    logger,
  });
  try {
    try {
      while (queue.has_pending() && pages.length < args.maxPages) {
        const url = queue.pop();
        if (url === null) break;
        logger.log("queue_pop", { url, visited_count: queue.visited().size });
        const result = await auditPage(driver, server, queue, url, viewports, {
          all_pages: args.all_pages,
          same_origin_host: targetUrl.host,
          logger,
        });
        const anchorAdded = queue.enqueue_many(result.anchor_urls);
        const bonusAdded = queue.enqueue_many(result.bonus_urls);
        logger.log("queue_extend", {
          url,
          anchor_count: result.anchor_urls.length,
          bonus_count: result.bonus_urls.length,
          anchor_added: anchorAdded,
          bonus_added: bonusAdded,
        });
        const pageFindings = _collect_page_findings(result);
        for (const [key, finding] of pageFindings)
          findingsByKey.set(key, finding);
        pages.push({
          url,
          title: null,
          viewports: viewportsFromSpecs(viewports),
          areas: [],
          findings: [...pageFindings.values()],
        });
      }
    } catch (error) {
      if (!(error instanceof BrowserDriverError)) throw error;
      warnings.push(`browser driver error: ${error.message}`);
      logger.log("browser_driver_error", { error: error.message });
    }
  } finally {
    try {
      driver.close();
    } finally {
      await server.close();
    }
  }

  const aggregate = aggregateReport(
    Object.fromEntries(
      viewports.map((viewport) => [viewport.label, viewportPayload(pages)]),
    ),
  );
  const report: Report = {
    contract_version: "3.0",
    target,
    generated_at: new Date().toISOString(),
    overall_score: aggregate.overall_score,
    risk: riskLiteral(aggregate.risk),
    pages,
    findings: [...findingsByKey.values()],
    recurring_elements: [],
    cross_origin_candidates: [...new Set(queue.cross_origin)],
    warnings,
  };
  const reportPath = writeReport(report, outDir);
  logger.log("audit_finish", {
    report: reportPath,
    page_count: pages.length,
    finding_count: findingsByKey.size,
    warning_count: warnings.length,
  });
  console.log(reportPath);
  return 0;
}

/** Collects and deduplicates findings from baseline and triggered reports. */
export function _collect_page_findings(
  result: PageAuditResult | Readonly<Record<string, unknown>>,
): Map<string, Finding> {
  const findings = new Map<string, Finding>();
  for (const report of iterReportPayloads(result)) {
    if (!isRecord(report.categories)) continue;
    for (const category of Object.values(report.categories)) {
      if (!isRecord(category) || !Array.isArray(category.issues)) continue;
      for (const issue of category.issues) {
        if (!isRecord(issue)) continue;
        let finding = buildFindingFromIssue(issue);
        const context: FlagContext = {
          confidence: extractConfidence(issue),
          has_text_over_background_image: detectBackgroundImage(issue),
        };
        finding = flagFinding(finding, context);
        findings.set(`${finding.rule_id}\0${finding.selector}`, finding);
      }
    }
  }
  return findings;
}

function parseArguments(argv: readonly string[]): AuditArguments {
  if (argv[0] === "-h" || argv[0] === "--help") {
    console.log(helpText());
    throw new CliExit(0);
  }
  if (argv.length === 0 || argv[0] !== "audit")
    throw new CliExit(2, helpText());
  if (argv[1] === "-h" || argv[1] === "--help") {
    console.log(auditHelpText());
    throw new CliExit(0);
  }
  if (argv.length < 2 || argv[1]?.startsWith("-"))
    throw new CliExit(
      2,
      "audit_cli audit: error: the following arguments are required: target",
    );

  let project: string | null = null;
  let out = ".audit-out";
  let maxPages = 25;
  let allPages = false;
  let viewport = "all";
  let dryRun = false;
  let cdpUrl: string | null = null;
  const seeds: string[] = [];

  for (let index = 2; index < argv.length; index += 1) {
    const rawOption = argv[index] ?? "";
    const equalsIndex = rawOption.indexOf("=");
    const option =
      equalsIndex < 0 ? rawOption : rawOption.slice(0, equalsIndex);
    const inlineValue =
      equalsIndex < 0 ? undefined : rawOption.slice(equalsIndex + 1);
    if (option === "--all-pages") {
      rejectFlagValue(option, inlineValue);
      allPages = true;
    } else if (option === "--dry-run") {
      rejectFlagValue(option, inlineValue);
      dryRun = true;
    } else if (option === "--project")
      [project, index] = optionValue(argv, index, option, inlineValue);
    else if (option === "--out")
      [out, index] = optionValue(argv, index, option, inlineValue);
    else if (option === "--cdp-url")
      [cdpUrl, index] = optionValue(argv, index, option, inlineValue);
    else if (option === "--max-pages") {
      const [raw, nextIndex] = optionValue(argv, index, option, inlineValue);
      maxPages = Number.parseInt(raw, 10);
      if (!/^-?\d+$/.test(raw))
        throw new CliExit(
          2,
          `audit_cli audit: error: argument --max-pages: invalid int value: '${raw}'`,
        );
      index = nextIndex;
    } else if (option === "--viewport") {
      [viewport, index] = optionValue(argv, index, option, inlineValue);
      if (!VIEWPORT_KINDS.has(viewport))
        throw new CliExit(
          2,
          `audit_cli audit: error: argument --viewport: invalid choice: '${viewport}'`,
        );
    } else if (option === "--seeds") {
      if (inlineValue !== undefined) seeds.push(inlineValue);
      while (index + 1 < argv.length && !argv[index + 1]?.startsWith("--"))
        seeds.push(argv[(index += 1)] ?? "");
    } else {
      throw new CliExit(
        2,
        `audit_cli audit: error: unrecognized arguments: ${rawOption}`,
      );
    }
  }
  return {
    command: "audit",
    target: argv[1] ?? "",
    project,
    out,
    maxPages: maxPages,
    all_pages: allPages,
    seeds,
    viewport,
    dry_run: dryRun,
    cdp_url: cdpUrl,
  };
}

function optionValue(
  argv: readonly string[],
  index: number,
  option: string,
  inlineValue: string | undefined,
): [string, number] {
  if (inlineValue !== undefined) {
    if (inlineValue.length === 0)
      throw new CliExit(
        2,
        `audit_cli audit: error: argument ${option}: expected one argument`,
      );
    return [inlineValue, index];
  }
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--"))
    throw new CliExit(
      2,
      `audit_cli audit: error: argument ${option}: expected one argument`,
    );
  return [value, index + 1];
}

function rejectFlagValue(
  option: string,
  inlineValue: string | undefined,
): void {
  if (inlineValue !== undefined)
    throw new CliExit(
      2,
      `audit_cli audit: error: argument ${option}: ignored explicit argument '${inlineValue}'`,
    );
}

function helpText(): string {
  return [
    "usage: audit_cli [-h] {audit} ...",
    "",
    "Site audit orchestrator.",
    "",
    "positional arguments:",
    "  {audit}",
    "    audit     Run an audit crawl against a target URL.",
  ].join("\n");
}

function auditHelpText(): string {
  return [
    "usage: audit_cli audit [-h] [--project PROJECT] [--out OUT]",
    "                       [--max-pages MAX_PAGES] [--all-pages]",
    "                       [--seeds [SEEDS ...]]",
    "                       [--viewport {mobile,tablet,desktop,wide,all}]",
    "                       [--dry-run] [--cdp-url CDP_URL]",
    "                       target",
    "",
    "positional arguments:",
    "  target                Seed URL to audit (e.g. https://example.com).",
  ].join("\n");
}

function selectViewports(kind: string): readonly ViewportSpec[] {
  return kind === "all"
    ? DEFAULT_VIEWPORTS
    : DEFAULT_VIEWPORTS.filter((viewport) => viewport.kind === kind);
}

function viewportsFromSpecs(specs: readonly ViewportSpec[]): Viewport[] {
  return specs.map((spec) => ({
    label: viewportLabel(spec.kind),
    width: spec.width,
    height: spec.height,
  }));
}

function viewportLabel(kind: string): ViewportLabel {
  return kind === "mobile" || kind === "tablet" || kind === "wide"
    ? kind
    : "desktop";
}

function iterReportPayloads(
  result: PageAuditResult | Readonly<Record<string, unknown>>,
): Array<Readonly<Record<string, unknown>>> {
  const payloads: Array<Readonly<Record<string, unknown>>> = [];
  if (isRecord(result.viewport_reports))
    payloads.push(...Object.values(result.viewport_reports).filter(isRecord));
  if (Array.isArray(result.triggered_reports)) {
    for (const item of result.triggered_reports)
      if (Array.isArray(item) && item.length === 2 && isRecord(item[1]))
        payloads.push(item[1]);
  }
  return payloads;
}

function extractConfidence(
  issue: Readonly<Record<string, unknown>>,
): number | null {
  if (typeof issue.confidence === "number") return issue.confidence;
  if (
    isRecord(issue.evidence) &&
    typeof issue.evidence.confidence === "number"
  )
    return issue.evidence.confidence;
  return null;
}

function detectBackgroundImage(
  issue: Readonly<Record<string, unknown>>,
): boolean {
  if (!isRecord(issue.evidence)) return false;
  if (
    Array.isArray(issue.evidence.heuristics) &&
    issue.evidence.heuristics.includes("background-image-text")
  )
    return true;
  return (
    typeof issue.evidence.domValue === "string" &&
    issue.evidence.domValue.includes("background-image") &&
    issue.evidence.domValue.includes("color")
  );
}

function viewportPayload(
  pages: readonly Page[],
): Readonly<Record<string, unknown>> {
  const issues = pages.flatMap((page) =>
    page.findings.map((finding) => ({
      ruleId: finding.rule_id,
      severity: severityBackToJs(finding.severity),
      selector: finding.selector,
      summary: finding.recommendation.action,
      category: "mixed",
    })),
  );
  return { categories: { mixed: { issues } } };
}

function severityBackToJs(severity: string): string {
  if (severity === "p0") return "critical";
  if (severity === "p1") return "high";
  return "medium";
}

function riskLiteral(risk: string): Report["risk"] {
  if (risk === "CRITICAL" || risk === "HIGH" || risk === "MEDIUM") return risk;
  return "LOW";
}

function peekQueue(queue: CrawlQueue): string[] {
  const pending: string[] = [];
  while (queue.has_pending()) {
    const url = queue.pop();
    if (url !== null) pending.push(url);
  }
  return pending;
}

function emptyReport(options: {
  readonly target: string;
  readonly origin: string;
  readonly pages: readonly Page[];
}): Report {
  return {
    contract_version: "3.0",
    target: options.target,
    generated_at: new Date().toISOString(),
    overall_score: 100,
    risk: "LOW",
    pages: options.pages,
    findings: [],
    recurring_elements: [],
    cross_origin_candidates: [],
    warnings: [`dry-run from ${options.origin}`],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (import.meta.main) {
  try {
    process.exitCode = await main();
  } catch (error) {
    const exception = error as Error;
    if (exception instanceof CliExit) process.exitCode = exception.exitCode;
    else throw error;
  }
}
