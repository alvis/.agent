# Canonical web-audit review template

<report>

Render audit findings into the shared Coding review-area schema. Never create a
standalone audit Markdown report or a Web-specific detail-file format. Web
fields enrich the canonical finding record; they do not replace its identity,
disposition, count, or verdict fields.

## Classification

Classify each finding once by the primary question it answers:

| Review file | Prefix | Web-audit ownership |
| --- | --- | --- |
| `alignment.md` | `ALIGN` | Active/durable design or approved-scope divergence |
| `correctness.md` | `CORR` | Broken interaction, navigation, feedback, semantics, or user task |
| `security.md` | `SEC` | Observed trust, permission, unsafe-content, or abuse issue only |
| `quality.md` | `QUAL` | Hierarchy, typography, color, spacing, responsive layout, imagery, motion, branding, maintainability |
| `testing.md` | `TEST` | Missing/unreliable page, viewport, state, crop, or manual-review coverage |
| `docs.md` | `DOCS` | Inaccurate or missing durable/user-facing design documentation |
| `style.md` | `STYL` | Mechanical token, CSS, or repository-style violation |

Do not duplicate one finding across areas. Design-contract compliance is
`alignment`; semantic failure is `correctness`; a token-style violation without
contract drift is `style`. A visual audit does not imply a security review.

Map the CLI's `critical|high|medium|low` severity to canonical
`P0|P1|P2|P3`, respectively. `info` is advisory: retain it in raw evidence and
concise context, but do not allocate a canonical priority finding or include it
in priority counts unless stronger evidence raises its severity. Never collapse
`low` into P2 or omit P3.

## Stable canonical identity

Build a stable Web source key from the CLI finding ID when present, otherwise
`<rule-id>--<route-hash8>--<selector-hash8>`. On first render, allocate the next
sequence for its canonical area and priority and persist both values in the
detail record:

```text
<PREFIX>-P<n>-<seq>
```

On rerun, match the persisted Web source key before allocating anything and
reuse its canonical ID. Never use a raw CLI ID as the Markdown heading, recycle
an old sequence for a different source key, or renumber findings merely because
another finding closed. If classification or priority evidence changes, retain
the stable ID and describe the change in evidence instead of creating a
duplicate.

## Detail file schema

Each applicable `reviews/<area>.md` uses the canonical Coding header and
verdict shape:

```markdown
---
area: <alignment|correctness|security|quality|testing|docs|style>
prefix: <ALIGN|CORR|SEC|QUAL|TEST|DOCS|STYL>
reviewed_at: <ISO-8601 timestamp>
files_reviewed_count: <N>
closed_findings: <N>
outstanding_findings: <N>
---

# <Area> review

**Verdict**: <pass|pass_with_suggestions|requires_changes|fail> — outstanding P0:<n> P1:<n> P2:<n> P3:<n>

## Headline

<One or two evidence-backed sentences. Use `_No issues found._` for a clean
area. Include the audit target, source report plus SHA-256, exact viewports, and
complete|partial|blocked coverage concisely.>

## Findings

### <PREFIX>-P<n>-<seq>: <one-line summary>

- **Status**: <open|fixed|acknowledged|deferred|skipped>
- **Source**: `<repository path:line, design clause, or report path + JSON pointer>`
- **Issue**: <problem, affected user task, and impact>
- **Evidence**: <rule/source key, route, viewport, selector, crop/context/data paths, and deterministic or AI confidence>
- **Direction**: <specific correction and observable acceptance check; never claim it was applied>
- **Rationale**: <why this current disposition is justified>
- **Owner**: <person or durable owning task/team>
- **Recheck condition**: <specific event, date, revision, viewport, or evidence that requires review again>
- **Risk acceptance**: <P0/P1 acknowledged/skipped authority and durable evidence; otherwise `not required`>
```

New findings begin `open`. Preserve a prior disposition only after matching its
source key and rechecking the current evidence. Apply the shared disposition
semantics exactly:

- `fixed` is closed only when the correction was applied and the affected
  route/viewports were rechecked with recorded evidence.
- `acknowledged` and `skipped` are closed non-fixed risk dispositions only with
  non-placeholder rationale, an accountable owner, and a concrete recheck
  condition. P0/P1 additionally require explicit risk-acceptance authority and
  durable acceptance evidence.
- `open` and `deferred` remain outstanding. A malformed `acknowledged` or
  `skipped` record is also outstanding until repaired.

Derive `closed_findings`, `outstanding_findings`, priority counts, and verdict
from all findings currently in that area file, including findings not emitted by
the latest Web run. Outstanding P0 yields `fail`; outstanding P1 yields
`requires_changes`; only outstanding P2/P3 yields `pass_with_suggestions`; zero
outstanding yields `pass`. Outstanding P0 or P1 blocks UI completion unless it
is closed or explicitly risk-accepted under the disposition rules above.

## Context and scoring

Keep the raw overall/category/page scores in JSON evidence. Markdown contains
only concise context and findings needed for engineering action. Preserve exact
scores when they materially prioritize a finding; never convert a score into an
unsupported quality claim.

When an active or durable design exists, cite its exact path and clause in
alignment findings. Otherwise omit design-compliance claims. The valid sources
are the active work design, `docs/design/system.md`, and applicable
`docs/design/<slug>.md`.

## PM reconciliation payload

Return, but do not write as a worker:

```yaml
review_reconciliation:
  source: <relative report path + SHA-256>
  coverage: complete|partial|blocked
  areas:
    alignment: {path: <absolute path or null>, verdict: <value or not_run>, open: 0, fixed: 0, acknowledged: 0, deferred: 0, skipped: 0, closed: 0, outstanding: 0, p0: 0, p1: 0, p2: 0, p3: 0}
    correctness: {path: <absolute path or null>, verdict: <value or not_run>, open: 0, fixed: 0, acknowledged: 0, deferred: 0, skipped: 0, closed: 0, outstanding: 0, p0: 0, p1: 0, p2: 0, p3: 0}
    security: {path: <absolute path or null>, verdict: <value or not_run>, open: 0, fixed: 0, acknowledged: 0, deferred: 0, skipped: 0, closed: 0, outstanding: 0, p0: 0, p1: 0, p2: 0, p3: 0}
    quality: {path: <absolute path or null>, verdict: <value or not_run>, open: 0, fixed: 0, acknowledged: 0, deferred: 0, skipped: 0, closed: 0, outstanding: 0, p0: 0, p1: 0, p2: 0, p3: 0}
    testing: {path: <absolute path or null>, verdict: <value or not_run>, open: 0, fixed: 0, acknowledged: 0, deferred: 0, skipped: 0, closed: 0, outstanding: 0, p0: 0, p1: 0, p2: 0, p3: 0}
    docs: {path: <absolute path or null>, verdict: <value or not_run>, open: 0, fixed: 0, acknowledged: 0, deferred: 0, skipped: 0, closed: 0, outstanding: 0, p0: 0, p1: 0, p2: 0, p3: 0}
    style: {path: <absolute path or null>, verdict: <value or not_run>, open: 0, fixed: 0, acknowledged: 0, deferred: 0, skipped: 0, closed: 0, outstanding: 0, p0: 0, p1: 0, p2: 0, p3: 0}
  totals: {open: 0, fixed: 0, acknowledged: 0, deferred: 0, skipped: 0, closed: 0, outstanding: 0, p0: 0, p1: 0, p2: 0, p3: 0}
  changed_detail_files: [<absolute paths>]
```

An absent area is `not_run`, not `pass` or `skipped`, unless an existing
canonical area file supplies current counts. The PM validates the payload
against every existing detail file and then reconciles `review.md`.

</report>
