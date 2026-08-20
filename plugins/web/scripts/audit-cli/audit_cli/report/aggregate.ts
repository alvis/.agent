/** per-category score and issue statistics */
export interface CategorySummary {
  readonly score: number;
  readonly issue_count: number;
  readonly top_severity: string | null;
}

/** site-level aggregate of scores, counts, and category summaries */
export interface AggregateResult {
  readonly overall_score: number;
  readonly risk: string;
  readonly category_scores: Record<string, number>;
  readonly category_summaries: Record<string, CategorySummary>;
  readonly severity_counts: Record<string, number>;
  readonly total_before_dedup: number;
  readonly total_deduplicated: number;
}

interface RuleBucket {
  occurrences: number;
  severity: string;
}

interface DedupEntry {
  issue: Record<string, unknown>;
  count: number;
}

/** penalty weight for each canonical severity */
export const SEVERITY_WEIGHTS: Readonly<Record<string, number>> = {
  critical: 22,
  high: 14,
  medium: 8,
  low: 4,
  info: 0,
};

/** maximum per-rule penalty for each canonical severity */
export const SEVERITY_CAPS: Readonly<Record<string, number>> = {
  critical: 24,
  high: 18,
  medium: 12,
  low: 6,
  info: 0,
};

/** severities ordered from highest to lowest */
export const SEVERITY_ORDER = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
] as const;

/** diminishing-return factor applied to repeated occurrences */
export const DIMINISHING_FACTOR = 0.7;

/** maximum total category penalty */
export const MAX_PENALTY = 45;

/** category hints for findings synthesized outside the browser aggregator */
export const CATEGORY_DEFINITIONS: Readonly<Record<string, string>> = {
  "DES-STAT-01": "interaction",
  "DES-MODA-01": "interaction",
  "DES-MODA-02": "interaction",
  "DES-MODA-03": "interaction",
  "DES-MODA-04": "interaction",
  "DES-NAVI-04": "interaction",
};

/**
 * clamps a severity to the canonical set
 * @param value candidate severity
 * @returns canonical severity or medium
 */
export function normalizeSeverity(value: unknown): string {
  return typeof value === "string" &&
    SEVERITY_ORDER.includes(value as (typeof SEVERITY_ORDER)[number])
    ? value
    : "medium";
}

/**
 * returns severity sort rank
 * @param value candidate severity
 * @returns zero-based rank with medium fallback
 */
export function severityRank(value: unknown): number {
  return SEVERITY_ORDER.indexOf(
    normalizeSeverity(value) as (typeof SEVERITY_ORDER)[number],
  );
}

/**
 * sums the diminishing-return penalty across occurrences
 * @param severity issue severity
 * @param occurrences occurrence count
 * @returns capped penalty
 */
export function penaltyForOccurrences(
  severity: string,
  occurrences: number,
): number {
  const canonical = normalizeSeverity(severity);
  const baseWeight = SEVERITY_WEIGHTS[canonical] ?? 0;
  const maximum = SEVERITY_CAPS[canonical] ?? 0;
  let penalty = 0;
  for (let index = 0; index < occurrences; index += 1) {
    penalty += baseWeight / (1 + index * DIMINISHING_FACTOR);
  }
  return Math.min(maximum, penalty);
}

/**
 * scores one category using the canonical formula
 * @param issues category issues
 * @returns score from zero through one hundred
 */
export function computeCategoryScore(
  issues: ReadonlyArray<Readonly<Record<string, unknown>>>,
): number {
  if (issues.length === 0) return 100;

  const ruleMap = new Map<string, RuleBucket>();
  for (const issue of issues) {
    const ruleId = pythonString(issue.ruleId || "unknown-rule");
    const severity = normalizeSeverity(issue.severity);
    const bucket = ruleMap.get(ruleId) ?? { occurrences: 0, severity };
    bucket.occurrences += 1;
    if (severityRank(severity) < severityRank(bucket.severity))
      bucket.severity = severity;
    ruleMap.set(ruleId, bucket);
  }

  const total = [...ruleMap.values()].reduce(
    (sum, bucket) =>
      sum + penaltyForOccurrences(bucket.severity, bucket.occurrences),
    0,
  );
  return Math.max(0, pythonRound(100 - Math.min(MAX_PENALTY, total)));
}

/**
 * averages category scores using Python rounding semantics
 * @param category_scores named category scores
 * @returns rounded overall score
 */
export function computeOverallScore(
  category_scores: Readonly<Record<string, number>>,
): number {
  const scores = Object.values(category_scores);
  if (scores.length === 0) return 100;
  return pythonRound(
    scores.reduce((sum, score) => sum + score, 0) / scores.length,
  );
}

/**
 * applies the canonical risk threshold ladder
 * @param severity_counts counts by severity
 * @returns uppercase risk label
 */
export function determineRisk(
  severity_counts: Readonly<Record<string, number>>,
): string {
  const critical = severity_counts.critical ?? 0;
  const high = severity_counts.high ?? 0;
  const medium = severity_counts.medium ?? 0;
  const low = severity_counts.low ?? 0;
  if (critical >= 1 || high >= 4) return "CRITICAL";
  if (high >= 1 || medium >= 6) return "HIGH";
  if (medium >= 1 || low >= 4) return "MEDIUM";
  return "LOW";
}

/**
 * deduplicates issues by viewport, rule, selector, and summary
 * @param issues issues to deduplicate
 * @param viewport viewport label
 * @returns first-seen issues with highest-severity representatives
 */
export function deduplicateIssues(
  issues: ReadonlyArray<Readonly<Record<string, unknown>>>,
  viewport: string,
): Array<Record<string, unknown>> {
  const entries = new Map<string, DedupEntry>();
  for (const issue of issues) {
    const key = [
      viewport || "default",
      pythonString(issue.ruleId || "unknown-rule"),
      pythonString(issue.selector || ""),
      pythonString(issue.summary || issue.details || ""),
    ].join("::");
    const entry = entries.get(key);
    if (!entry) {
      entries.set(key, { issue: { ...issue }, count: 1 });
    } else {
      entry.count += 1;
      if (severityRank(issue.severity) < severityRank(entry.issue.severity))
        entry.issue = { ...issue };
    }
  }

  return [...entries.values()].map((entry) => {
    if (entry.count <= 1) return entry.issue;
    const evidence = isRecord(entry.issue.evidence) ? entry.issue.evidence : {};
    evidence.duplicateCount = entry.count;
    entry.issue.evidence = evidence;
    return entry.issue;
  });
}

/**
 * sorts issues by severity then lowercase category
 * @param issues issues to sort
 * @returns copied, sorted issues
 */
export function sortIssues(
  issues: Iterable<Readonly<Record<string, unknown>>>,
): Array<Record<string, unknown>> {
  return [...issues]
    .map((issue) => ({ ...issue }))
    .sort((left, right) => {
      const severityDifference =
        severityRank(left.severity) - severityRank(right.severity);
      if (severityDifference !== 0) return severityDifference;
      const leftCategory = pythonString(left.category || "").toLowerCase();
      const rightCategory = pythonString(right.category || "").toLowerCase();
      if (leftCategory < rightCategory) return -1;
      if (leftCategory > rightCategory) return 1;
      return 0;
    });
}

/**
 * returns the highest severity present
 * @param issues issues to inspect
 * @returns highest severity or null
 */
export function topSeverity(
  issues: ReadonlyArray<Readonly<Record<string, unknown>>>,
): string | null {
  if (issues.length === 0) return null;
  let best = "info";
  for (const issue of issues) {
    const canonical = normalizeSeverity(issue.severity);
    if (severityRank(canonical) < severityRank(best)) best = canonical;
  }
  return best;
}

/**
 * merges per-viewport outputs into a site summary
 * @param viewport_reports named viewport reports
 * @returns aggregate scores and counts
 */
export function aggregateReport(
  viewport_reports: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
): AggregateResult {
  const categoryIssues: Record<string, Array<Record<string, unknown>>> = {};
  const allIssues: Array<Record<string, unknown>> = [];
  let viewportLabel = "default";

  for (const [label, report] of Object.entries(viewport_reports)) {
    viewportLabel = label;
    if (!isRecord(report.categories)) continue;
    for (const [category, value] of Object.entries(report.categories)) {
      if (!isRecord(value) || !Array.isArray(value.issues)) continue;
      const issues = value.issues.filter(isRecord);
      (categoryIssues[category] ??= []).push(...issues);
      allIssues.push(...issues);
    }
  }

  const categoryScores = Object.fromEntries(
    Object.entries(categoryIssues).map(([name, issues]) => [
      name,
      computeCategoryScore(issues),
    ]),
  );
  const categorySummaries = Object.fromEntries(
    Object.entries(categoryIssues).map(([name, issues]) => [
      name,
      {
        score: categoryScores[name] ?? 0,
        issue_count: issues.length,
        top_severity: topSeverity(issues),
      },
    ]),
  );
  const deduplicated = deduplicateIssues(allIssues, viewportLabel);
  const severityCounts = Object.fromEntries(
    SEVERITY_ORDER.map((severity) => [severity, 0]),
  );
  for (const issue of deduplicated) {
    const severity = normalizeSeverity(issue.severity);
    severityCounts[severity] = (severityCounts[severity] ?? 0) + 1;
  }

  return {
    overall_score: computeOverallScore(categoryScores),
    risk: determineRisk(severityCounts),
    category_scores: categoryScores,
    category_summaries: categorySummaries,
    severity_counts: severityCounts,
    total_before_dedup: allIssues.length,
    total_deduplicated: deduplicated.length,
  };
}

function pythonRound(value: number): number {
  const floor = Math.floor(value);
  const fraction = value - floor;
  if (Math.abs(fraction - 0.5) < Number.EPSILON)
    return floor % 2 === 0 ? floor : floor + 1;
  return Math.round(value);
}

function pythonString(value: unknown): string {
  if (value === null) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
