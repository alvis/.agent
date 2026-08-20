/** severity exposed by the contract-v3 JSON wire format */
export type Severity = "p0" | "p1" | "p2";

/** viewport label exposed by the contract-v3 JSON wire format */
export type ViewportLabel = "mobile" | "tablet" | "desktop" | "wide";

/** interaction-origin metadata attached to finding evidence */
export interface TriggeredBy {
  readonly uid: number;
  readonly role: string;
  readonly name: string;
}

/** ground-truth artifacts backing a single finding */
export interface Evidence {
  readonly dom_value?: string | null;
  readonly crop_path?: string | null;
  readonly triggered_by?: TriggeredBy | null;
}

/** prescriptive remediation guidance for a finding */
export interface Recommendation {
  readonly action: string;
  readonly code_suggestion: string;
  readonly rule_ref: string;
}

/** verdict supplied after subjective AI review */
export interface AiVerdict {
  readonly passed: boolean;
  readonly confidence: number;
  readonly rationale: string;
}

/** single rule violation surfaced by the audit pipeline */
export interface Finding {
  readonly rule_id: string;
  readonly severity: Severity;
  readonly selector: string;
  readonly evidence: Evidence;
  readonly recommendation: Recommendation;
  readonly needs_ai_review: boolean;
  readonly pages?: readonly string[];
  readonly viewports?: readonly ViewportLabel[];
  readonly ai_prompt?: string | null;
  readonly hypothesis?: string | null;
  readonly ai_verdict?: AiVerdict | null;
}

/** cross-page reusable component discovered during crawling */
export interface RecurringElement {
  readonly element_id: string;
  readonly selector: string;
  readonly role: string;
  readonly page_count: number;
  readonly sample_pages: readonly string[];
}

/** viewport descriptor for a single audit run */
export interface Viewport {
  readonly label: ViewportLabel;
  readonly width: number;
  readonly height: number;
}

/** named region of a page */
export interface Area {
  readonly name: string;
  readonly selector: string;
  readonly bounding_box?: readonly [number, number, number, number] | null;
}

/** source-derived route candidate */
export interface Route {
  readonly path: string;
  readonly source_file: string;
  readonly framework: string;
  readonly warning?: string | null;
}

/** plan entry describing an interactive element to exercise */
export interface InteractionCandidate {
  readonly uid: number;
  readonly role: string;
  readonly name: string;
  readonly fingerprint: string;
  readonly expanded?: boolean | null;
}

/** ordered plan of unique interactions to trigger on a page */
export interface InteractionPlan {
  readonly candidates: readonly InteractionCandidate[];
  readonly cross_origin_candidates: readonly string[];
  readonly dropped_social: readonly string[];
}

/** findings and metadata for a single crawled URL */
export interface Page {
  readonly url: string;
  readonly title: string | null;
  readonly viewports: readonly Viewport[];
  readonly areas: readonly Area[];
  readonly findings: readonly Finding[];
}

/** mutable per-page output accumulated by the crawl loop */
export interface PageAuditResult {
  url: string;
  viewport_reports: Record<string, Readonly<Record<string, unknown>>>;
  anchor_urls: string[];
  bonus_urls: string[];
  triggered_reports: Array<
    readonly [string, Readonly<Record<string, unknown>>]
  >;
  hover_findings: ReadonlyArray<Record<string, unknown>>;
  modal_findings: ReadonlyArray<Record<string, unknown>>;
}

/** root contract-v3 object serialized to report.json */
export interface Report {
  readonly contract_version: string;
  readonly target: string;
  readonly generated_at: string;
  readonly overall_score: number;
  readonly risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly pages: readonly Page[];
  readonly findings: readonly Finding[];
  readonly recurring_elements: readonly RecurringElement[];
  readonly cross_origin_candidates: readonly string[];
  readonly warnings: readonly string[];
}
