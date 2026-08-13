# MDC Idioms — Worked Examples

Six condensed, real-world MDC idioms drawn from Notion-backed documents and
the `@theriety/mdc` reference docs. Each example is ≤ ~30 lines. Loaded by the
skill in `author` mode (and useful as patterns when editing).

---

## 1. Notion Spec — front matter + ref-bearing block tree

Pattern: every block carries a Notion-page-id `ref`. Closing markers are emitted because every ref-bearing block with children gets one by stringifier default.

```markdown
---
title: Quarterly Review
last_edited_time: 2026-01-15T10:00:00.000Z
Status: Draft
Owner:
  - name: Jane Doe
    email: jane@example.com
ref: 2dab2572-f788-8060-9764-eb325cb0c894
---

{{ ref: 0efe9c64-67a0-4ab5-aeee-b62cd46d3094 }}
📌 **Introduction**

{{ ref: aa164109-75d5-41fc-b11d-ee83bc1f00de }}
This is the first paragraph with a Notion-page ID as its ref.

{{ ref: da2f0a0a-e25b-4f48-9e75-d99b75b94282 }}
## 🔑 Key Takeaways
  {{ ref: 0585bcd7-ee32-4935-9d4c-a600f036e1e4 }}
  - **Human-first, machine-ready**
  {{ ref: 81576982-b2b1-480b-aa47-b37357a9e2b1 }}
  - **Universal annotation syntax**
--{ ref: da2f0a0a-e25b-4f48-9e75-d99b75b94282 }--
```

Note the closing marker on the `## Key Takeaways` heading because it has children. The two paragraphs above it are ref'd but childless — no marker.

---

## 2. Spreadsheet — inline annotations for cell expressions and formats

Pattern: tabular MDC with front matter declaring sheet metadata; inline `[value]{{ … }}` annotations carry formula, format, and styling per cell.

```markdown
---
ref: sales-q4-2025
type: sheet
title: Q4 2025 Sales Report
cols: 6
rows: 5
ranges:
  - ref: headers
    cells: A1:F1
    style: header
---

|   | A           | B                                  | C                                                          |
|---|-------------|------------------------------------|------------------------------------------------------------|
| 1 | Product     | Oct                                | Q4 Total                                                   |
| 2 | Widget Pro  | [45000]{{ format: currency }}      | [165000]{{ expression: SUM(B2:D2), format: currency }}     |
| 3 | Widget Lite | [22000]{{ format: currency }}      | [ 78000]{{ expression: SUM(B3:D3), format: currency }}     |
```

Front matter declares the sheet shape; cell formulas live as inline annotations on the displayed value. The displayed value is what a human reads; the `expression:` parameter is what a spreadsheet engine evaluates.

---

## 3. Medical Records — inline `source:` provenance

Pattern: free prose where each clinically meaningful span carries inline metadata about origin, severity, ICD code, etc. No nested blocks — the structure is entirely inline.

```markdown
---
patient_id: P-12345
encounter_type: follow-up
provider: '@dr.chen'
encounter_date: 2026-01-03
icd_codes: [E11.9, I10]
confidentiality: PHI
---

Patient reports [persistent fatigue]{{ source: patient, onset: 2025-11-20 }}
and [elevated BP readings at home]{{ source: patient, readings: '145/92, 150/88' }}.

Exam reveals [mild peripheral edema]{{ source: clinician, snomed: 267038008, severity: mild }}.
Vitals: [BP 148/94]{{ source: clinician, method: manual }}.

Assessment: [Type 2 diabetes]{{ icd: E11.9, confidence: confirmed }} with
[hypertension]{{ icd: I10, confidence: confirmed }}, suboptimally controlled.

Plan: [Increase metformin to 1000mg BID]{{ action: prescribe, drug: metformin, dose: '1000mg' }}.
```

Each inline annotation immediately follows its `]` with no whitespace. Quoted values use single quotes when the YAML scalar contains commas or special characters.

---

## 4. Intelligence Brief — classification banner block + inline confidence

Pattern: a top-level annotated block sets the classification of the document; inline annotations on each assertion carry source type, confidence, and corroboration count.

```markdown
---
classification: CONFIDENTIAL
report_id: IR-2026-0042
sources: [HUMINT, OSINT]
overall_confidence: moderate
analyst: '@j.smith'
date_produced: 2026-01-03
---

{{ type: banner, classification: CONFIDENTIAL, ref: classification-header }}
**CONFIDENTIAL — INTELLIGENCE BRIEF — IR-2026-0042**

[Satellite imagery confirms]{{ source: IMINT, confidence: high }}
increased activity at the northern facility.

[Local sources report]{{ source: HUMINT, confidence: moderate, corroboration: 2 }}
approximately [150-200 personnel]{{ confidence: low, basis: estimation }}
arrived since [December 28]{{ as_of: 2025-12-28 }}.
```

`{{ type: banner, … }}` is a block annotation with an explicit `type` override — the parser would otherwise infer `paragraph` for the bold line. The block carries a `ref` but no children, so no closing marker.

---

## 5. Scientific Lab — code-fenced data block + outer annotation

Pattern: a fenced code block contains structured data (CSV / JSON / experiment dump); the wrapping annotation tags it with format and schema info.

```markdown
{{ ref: experiment-042-readings, type: data, format: csv, schema: lab.v3 }}
```csv
timestamp,sample_id,absorbance,temperature
2026-01-12T09:00:00Z,S001,0.412,22.4
2026-01-12T09:15:00Z,S002,0.418,22.5
2026-01-12T09:30:00Z,S003,0.421,22.6
```

{{ ref: experiment-042-notes }}
Absorbance climbed monotonically; temperature stable within ±0.2°C.
```

Inside the fenced block, **no MDC escaping is required** — the content is parser-opaque. The annotation above the fence carries machine-readable metadata about what's inside.

---

## 6. Nested Toggle Tree (Notion-style) — markers protect the hierarchy

Pattern: a long document with toggleable headings, each with multiple paragraphs as children. Markers are essential because LLM edits would otherwise drop indent levels and detach children.

```markdown
{{ is_toggleable: true, ref: 2e1b2572-f788-80cd-8e1f-e56b4f7fdf15 }}
## ✍️ Syntax Reference
  {{ ref: 2e1b2572-f788-8018-b7bd-fd8d680bbf05 }}
  A complete grammar reference for the MDC format.
  {{ is_toggleable: true, ref: 2e1b2572-f788-80ea-87e4-cd3f4d89068a }}
  ### Document Structure
    {{ ref: 2e1b2572-f788-8025-9895-d24995adcb5f }}
    **Front Matter** (optional)
    {{ ref: 2e1b2572-f788-8034-8125-eca6777da2f0 }}
    Documents may begin with a YAML front matter block.
  --{ ref: 2e1b2572-f788-80ea-87e4-cd3f4d89068a }--
--{ ref: 2e1b2572-f788-80cd-8e1f-e56b4f7fdf15 }--
```

Two closing markers, stacked innermost-first. Each marker's `ref` matches its opening; each marker's leading whitespace matches its opening. If a future edit drops one of the inner paragraphs to a lower indent, the markers keep it inside the right parent.
