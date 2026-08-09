# Data audit streams

Dispatch schema, operation, and controller checks independently. Each prompt
contains only exact specification paths/headings, implementation paths,
canonical output-area template, and applicable standards. The auditor treats
the code as unfamiliar, reads only, and returns candidates rather than editing.

## Shared result

```yaml
status: success|failure|partial
candidates:
  - contract_location: '<spec path:heading>'
    implementation_location: '<path:line or missing>'
    category: alignment|correctness|security|quality|testing|docs|style
    severity: P0|P1|P2|P3
    headline: ''
    evidence: ''
    recommendation: ''
issues: []
```

The parent adversarially validates, deduplicates, assigns stable IDs, and writes
survivors to the canonical review file. Stream reports are not deliverables.

## Schema stream

Compare entity models, fields, types, relationships, constraints, indexes, and
migrations with exact work-spec sections and `standards/data-entity/`.
Contract mismatches route to alignment; defects independent of spec route to
correctness; unsafe data boundaries route to security.

## Operation stream

Compare declared operations, verb patterns, selectors, error semantics,
side-effects, and integration tests with exact work-spec sections and
`standards/data-operation/`. Missing/spec-drift operations route to alignment;
test evidence gaps route to testing.

## Controller stream

Compare controller exposure/delegation with operation inventory and both data
standards. Missing/extra contract surface routes to alignment; broken
delegation routes to correctness or quality based on behavioral impact.

Every dispatch starts from its mission capsule's exact specification,
implementation, and output paths. Read `state/working.md` only when navigation is
missing, and `state.md` only for alignment, resume, or a cross-stream
dependency the capsule identifies. Return only findings plus an empty
`generated_files` manifest because audit streams are read-only.
