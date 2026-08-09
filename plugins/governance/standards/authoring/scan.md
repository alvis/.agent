# Governance Authoring Invariants: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

Any single violation blocks submission by default.
If a violation is detected, load the matching rule guide at `./rules/<lowercase-rule-id>.md`.

## Quick Scan

- DO NOT retain content whose removal would not change what someone does [`AUT-CONT-01`]
- DO NOT append corrections, addenda, or duplicate guidance instead of integrating policy coherently [`AUT-CONT-02`]
- DO NOT make an artifact concise by removing decisions, failure behavior, or verification required to execute it [`AUT-CONT-03`]
- DO NOT let important or long content bleed into surrounding prose without a semantic boundary tag [`AUT-BOUN-01`]
- DO NOT use boundary tags as section-heading substitutes, omit language hints inside fenced blocks, or leave tags unbalanced [`AUT-BOUN-02`]
- DO NOT delegate small inline work or retain context-heavy work solely to avoid a bounded assignment and report [`AUT-DELG-01`]

## Rule Matrix

| Rule ID | Violation | Bad Examples |
|---|---|---|
| `AUT-CONT-01` | Non-operational filler | Generic encouragement; unbounded example-negation lists |
| `AUT-CONT-02` | Fragmented policy | `## Addendum`; a second contradictory workflow |
| `AUT-CONT-03` | Under-specified contract | An outcome with no failure behavior or verification |
| `AUT-BOUN-01` | Missing semantic boundary | A long output schema flowing directly into workflow prose |
| `AUT-BOUN-02` | Malformed boundary structure | `<report>` without `</report>`; a tag replacing `## Completion` |
| `AUT-DELG-01` | Context-inefficient execution | Delegating a one-line edit; reading hundreds of files inline |
