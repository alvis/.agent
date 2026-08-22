# Phase 3 -- AI Visual Review (Detail)

Loaded by `SKILL.md` Step 3. Fills in AI verdicts for findings the CLI marked `needs_ai_review`, and resolves cross-origin expansion questions.

**Step Configuration**:

- **Purpose**: Fill in AI verdicts for findings the CLI marked `needs_ai_review`, and resolve cross-origin expansion questions
- **Input**: `<audit-dir>/report.json` (contract v3; see `../../../scripts/audit-cli/audit_cli/types.ts`)
- **Output**: `<audit-dir>/report-final.json` with `ai_verdict` populated
- **Parallel Execution**: No

Claude does **not** re-run the crawl, does **not** re-audit code-shaped rules, and does **not** second-guess automated findings. Claude fills in `ai_verdict` only for items the CLI explicitly flagged.

## 3.1 Read the Report

1. Read `<audit-dir>/report.json` (path captured from the CLI stdout).
2. Validate the contract version matches v3 (see `../../../scripts/audit-cli/audit_cli/types.ts`). If not, stop and surface the mismatch.

## 3.2 Resolve Cross-Origin Candidates

If `report.cross_origin_candidates` is non-empty:

1. Use **the graphical or structured user-input tool once** with the list grouped by origin (social-media hosts are already excluded by the CLI).
2. The user's answer determines which cross-origin pages to include in a follow-up scope. Record declined origins for the Phase 4 site-level section.
3. Do not prompt again during this audit.

If the list is empty, skip this step.

## 3.3 Adjudicate `needs_ai_review` Findings

The 11 AI-grounded rules are: **DES-CONS-01 (visual), DES-PRIM-01, DES-HIER-02, DES-FEED-01, DES-FEED-02, DES-NAV-01, DES-NAV-02, DES-COPY-01, DES-COPY-02, DES-ICON-01, DES-MOTI-01**.

### Pre-Adjudication Gate (Visual Grounding Contract)

Before applying the AI prompt to any finding, enforce this gate:

1. Each finding **MUST** carry a primary `evidence.crop_path` that is a **section crop** -- bounded by `getBoundingClientRect()` of a known section element (nav, hero, mid, footer at minimum; TOC/CTA/pricing-band when detected), with height typically **<1.5x the viewport**.
2. A finding **MAY** additionally provide `evidence.context_path` pointing at a full-page top-to-bottom screenshot for supplementary context (disambiguating location, cross-section rhythm). Open both when present, but **reason primarily from the section crop**.
3. If the only image attached to a finding is a full-page screenshot (no section crop present, or the path resolves to a full-page artifact), **do not adjudicate the rule**. Instead, record:
   ```json
   {
     "passed": null,
     "confidence": 0.0,
     "rationale": "missing_section_crop"
   }
   ```
   Surface this as a **skill defect** (capture pipeline did not produce a section crop), not a rule failure. Continue to the next finding.

### Adjudication

For each finding where `needs_ai_review` is true **and** the gate above is satisfied:

1. Open `evidence.crop_path` (section crop on disk) as the primary image. If `evidence.context_path` is present, open it as supplementary context only.
2. Apply `finding.ai_prompt` literally -- it is a specific question written by the CLI. Do not paraphrase or expand it.
3. Fill `finding.ai_verdict`:
   ```json
   {
     "passed": true,
     "confidence": 0.0,
     "rationale": ""
   }
   ```
   - `passed` (bool | null): whether the rule passes based on what is visible in the section crop; `null` only when the pre-adjudication gate fails
   - `confidence` (float 0.0-1.0): your confidence in the verdict
   - `rationale` (str): concise explanation citing visible evidence in the section crop (or `"missing_section_crop"` when gated out)

## 3.4 Persist Merged Report

Write the merged report to `<audit-dir>/report-final.json`. Canonical review rendering reads exclusively from this file when it exists.
