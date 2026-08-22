import type { AiVerdict, Finding, Severity } from "../types";

/** per-issue context used by AI flagging logic */
export interface FlagContext {
  readonly confidence?: number | null;
  readonly has_text_over_background_image?: boolean;
  readonly prompt_override?: string | null;
  readonly hypothesis_override?: string | null;
}

/** rules that always require subjective AI review */
export const AI_GROUNDED_RULES: ReadonlySet<string> = new Set([
  "DES-CONS-01",
  "DES-PRIM-01",
  "DES-HIER-02",
  "DES-FEED-01",
  "DES-FEED-02",
  "DES-NAV-01",
  "DES-NAV-02",
  "DES-COPY-01",
  "DES-COPY-02",
  "DES-ICON-01",
  "DES-MOTI-01",
]);

/** confidence below which automated findings require AI review */
export const CONFIDENCE_THRESHOLD = 0.7;

/**
 * returns whether a finding needs subjective AI review
 * @param finding candidate finding
 * @param context flagging context
 * @returns true when any routing condition applies
 */
export function shouldFlagForAi(
  finding: Finding,
  context: FlagContext,
): boolean {
  return (
    AI_GROUNDED_RULES.has(finding.rule_id) ||
    (context.confidence !== undefined &&
      context.confidence !== null &&
      context.confidence < CONFIDENCE_THRESHOLD) ||
    context.has_text_over_background_image === true
  );
}

/**
 * returns a copied finding with AI routing fields applied
 * @param finding candidate finding
 * @param context flagging context
 * @returns flagged or explicitly unflagged finding
 */
export function flagFinding(finding: Finding, context: FlagContext): Finding {
  if (!shouldFlagForAi(finding, context)) {
    return {
      ai_prompt: null,
      hypothesis: null,
      ai_verdict: null,
      ...finding,
      needs_ai_review: false,
    };
  }
  return {
    ...finding,
    needs_ai_review: true,
    ai_prompt: context.prompt_override || defaultPrompt(finding),
    hypothesis: context.hypothesis_override || defaultHypothesis(finding),
  };
}

/**
 * translates a raw browser issue into a typed finding
 * @param issue raw issue mapping
 * @returns normalized finding
 */
export function buildFindingFromIssue(
  issue: Readonly<Record<string, unknown>>,
): Finding {
  const evidence = isRecord(issue.evidence) ? issue.evidence : {};
  const recommendation = isRecord(issue.recommendation)
    ? issue.recommendation
    : {};
  return {
    rule_id: pythonString(issue.ruleId ?? "unknown-rule"),
    severity: mapSeverity(pythonString(issue.severity ?? "medium")),
    selector: pythonString(issue.selector ?? ""),
    evidence: {
      dom_value: evidence.domValue ? pythonString(evidence.domValue) : null,
      crop_path: evidence.cropPath ? pythonString(evidence.cropPath) : null,
      triggered_by: null,
    },
    recommendation: {
      action: recommendation.action
        ? pythonString(recommendation.action)
        : pythonString(issue.summary ?? ""),
      code_suggestion: pythonString(recommendation.codeSuggestion),
      rule_ref: isRecord(issue.recommendation)
        ? pythonString(recommendation.ruleRef)
        : pythonString(issue.ruleId ?? ""),
    },
    needs_ai_review: false,
    pages: [],
    viewports: [],
    ai_prompt: null,
    hypothesis: null,
    ai_verdict: null,
  };
}

/**
 * attaches an AI verdict to a finding
 * @param finding reviewed finding
 * @param verdict_payload raw verdict mapping
 * @returns copied finding with verdict
 */
export function mergeAiVerdict(
  finding: Finding,
  verdict_payload: Readonly<Record<string, unknown>>,
): Finding {
  const confidenceRaw = verdict_payload.confidence ?? 0;
  const confidence = ["number", "string"].includes(typeof confidenceRaw)
    ? Number(confidenceRaw)
    : typeof confidenceRaw === "boolean"
      ? Number(confidenceRaw)
      : 0;
  if (Number.isNaN(confidence))
    throw new TypeError(
      `could not convert string to float: '${String(confidenceRaw)}'`,
    );
  const verdict: AiVerdict = {
    passed: Boolean(verdict_payload.passed ?? false),
    confidence,
    rationale: pythonString(verdict_payload.rationale ?? ""),
  };
  return { ...finding, ai_verdict: verdict };
}

function mapSeverity(raw: string): Severity {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "critical" || normalized === "p0") return "p0";
  if (normalized === "high" || normalized === "p1") return "p1";
  return "p2";
}

function defaultPrompt(finding: Finding): string {
  return `Does the element matching '${finding.selector}' satisfy ${finding.rule_id}? Inspect the attached crop and answer passed/confidence/rationale.`;
}

function defaultHypothesis(finding: Finding): string {
  return (
    finding.recommendation.action ||
    "CLI could not determine outcome deterministically."
  );
}

function pythonString(value: unknown): string {
  if (value === undefined) return "None";
  if (value === null) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
