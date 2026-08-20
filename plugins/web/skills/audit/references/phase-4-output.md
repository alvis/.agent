# Canonical review rendering

<report>

Render actionable Markdown from `<audit-dir>/report-final.json`, or from
`report.json` with explicit partial coverage when manual adjudication is not
complete. Raw data remains evidence; canonical work review files are the human
engineering interface.

## Source validation

Before rendering:

1. Require contract version `3.0` and retain the source path plus SHA-256.
2. Preserve audited URLs, exact viewport dimensions, CLI exit status, warnings,
   capped/unvisited pages, cross-origin exclusions, orphan routes, recurring
   elements, crop/context paths, and manual-review coverage.
3. Verify every final AI verdict cites a focused crop or records
   `missing_section_crop` with null verdict.
4. Build one stable Web source key from the CLI finding ID when present,
   otherwise `<rule-id>--<route-hash8>--<selector-hash8>`. This key locates the
   existing canonical `<PREFIX>-P<n>-<seq>` ID; it is not itself the Markdown
   finding ID.

## Classification and writing

Apply `review-template.md` and classify each finding exactly once. Map
`critical|high|medium|low` to `P0|P1|P2|P3`; retain `info` as advisory raw
evidence without a canonical priority ID unless stronger evidence raises its
severity. Group actionable findings by canonical review area,
then priority and stable source key. Before allocating an ID, load the applicable
existing area file and reuse the canonical ID already paired with that source
key. Allocate only genuinely new IDs using the area's canonical prefix and its
next unused sequence. Never renumber old IDs or use raw CLI IDs as headings.

Write only applicable `reviews/<area>.md` files. Each written file must retain
the canonical frontmatter, verdict line, required finding fields, and existing
findings not owned by this Web run. Merge by source key so a rerun updates
evidence without erasing dispositions, owners, recheck conditions, risk
acceptance, or findings from other reviewers. Recompute the file's five
disposition counts, derived closed/outstanding counts, outstanding P0-P3 counts,
and verdict from the entire resulting file.

Coverage defects are findings in `testing.md`, including:

- zero audited pages or capped/unvisited required pages;
- missing required viewport/state data;
- missing focused crop for AI adjudication;
- driver warnings that invalidate claimed coverage; and
- incomplete manual review.

Site-level navigation or interaction failures belong to `correctness.md`.
Recurring visual issues are one `quality.md` finding with all affected routes,
not duplicate per-page prose. Cross-origin candidates declined by the user are
recorded as scope evidence, not defects.

## PM roll-up handoff

Validate every written area against `review-template.md`, then return its
reconciliation payload. For each area, report all five dispositions, derived
closed/outstanding counts, P0-P3 counts, verdict, and path. An absent area is
`not_run` with zeroes unless an existing canonical area file supplies current
counts; it is never silently reported as `pass` or `skipped`. Add:

```yaml
audit_summary:
  overall_score: <exact CLI value>
  risk: critical|high|medium|low
  pages_audited: <n>
  viewports: [<label + dimensions>]
  worst_pages: [<URL + score + primary finding IDs>]
  warnings: [<exact warnings>]
  raw_evidence: [<absolute final paths>]
```

This payload is for PM reconciliation into `review.md`; a worker does not write
the roll-up. Conversation output is a concise status, top open findings, exact
review/evidence paths, and coverage limitations rather than a competing report.

## Multi-page audits

Keep per-page and per-viewport data in JSON. Canonical findings cite every
affected page. Sort the concise handoff's worst pages from lowest score upward,
but retain all details in source evidence and review findings.

</report>
