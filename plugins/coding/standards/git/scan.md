# Pull-Request Changes: Violation Scan

> **Prerequisite**: Read `meta.md` first for authority, inputs, exceptions, and
> rule groups.

Any violation is an issue that requires a fix. Use `write.md` for compliant
outcomes and load the matching guide from `rules/`.

## Mechanical Scans

- Classify each exact base/head surface with
  [classify-pr-size.py](../../skills/pr/scripts/classify-pr-size.py); never
  estimate a zone or reproduce its arithmetic.
- Validate a rendered PR message with
  [scan-pr-message.py](../../skills/pr/scripts/scan-pr-message.py), passing its
  selected template, exact head/base OIDs, zone, archetype, and generated
  paths. A nonzero result is a standard violation, not an authoring hint.

## Semantic Scans

Inspect the implementation diff for mixed specification and implementation,
migrations coupled to logic, mechanical changes hiding behavior, generated
output that is neither isolated nor marked, and nontrivial behavior lacking a
feature flag. Syntax alone cannot establish these findings.

Do not report commit messages, branch names, PR titles, draft state, labels,
stack position, history mutation, or merge order as standard violations. They
are directions in [coding:commit](../../skills/commit/SKILL.md) and the
[PR router](../../skills/pr/SKILL.md), and are process chores when unmet.

## Quick Scan

- DO NOT publish a PR message that fails the selected template scan [`GIT-PR-02`]
- DO NOT misclassify generated paths or authored net LOC [`GIT-PR-SIZE-01`]
- DO NOT omit required Risk or Test plan evidence outside green [`GIT-PR-SIZE-02`]
- DO NOT omit a specific indivisibility rationale in red [`GIT-PR-SIZE-03`]
- DO NOT publish a black draft without its required message evidence or approve it without exact-revision OWNER authorization [`GIT-PR-SIZE-04`]
- DO NOT mix spec or required scaffolding with an over-green implementation [`GIT-PR-TYPE-02`]
- DO NOT mix migrations with logic or omit migration rollback evidence [`GIT-PR-TYPE-03`]
- DO NOT mix mechanical refactors with behavior changes [`GIT-PR-TYPE-04`]
- DO NOT leave generated files unmarked in a mixed PR [`GIT-PR-TYPE-05`]
- DO NOT ship nontrivial behavior without a feature flag or its required message evidence [`GIT-PR-STACK-04`]

## Rule Matrix

| Rule ID | Violation | Bad Example |
|---|---|---|
| `GIT-PR-02` | Rendered message fails template scan | Missing Verification |
| `GIT-PR-SIZE-01` | Wrong size inputs or zone | Generated path omitted from file count |
| `GIT-PR-SIZE-02` | Missing non-green evidence | Yellow PR without Risk |
| `GIT-PR-SIZE-03` | Missing red rationale | Generic or absent Why this size |
| `GIT-PR-SIZE-04` | Missing black evidence or approval gate | Approval without live OWNER authorization |
| `GIT-PR-TYPE-02` | Spec mixed with over-green implementation | Public types plus behavior |
| `GIT-PR-TYPE-03` | Migration mixed with logic or missing rollback | Schema and business rule together |
| `GIT-PR-TYPE-04` | Mechanical and behavioral changes mixed | Rename plus new method |
| `GIT-PR-TYPE-05` | Unmarked generated output | Generated client mixed without evidence |
| `GIT-PR-STACK-04` | Nontrivial behavior lacks a flag or evidence | Ungated pricing-engine replacement |
