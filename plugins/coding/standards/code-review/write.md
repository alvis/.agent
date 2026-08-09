# Code Review Standards: Compliant Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

## Key Principles

- Verify correctness and security before lower-impact concerns.
- Treat every correction as evidence that improves the result, not as personal criticism.
- Separate code quality from personal worth while holding the quality bar.
- State the problem, impact, evidence, and practical next action.
- Match review depth to change size and risk.
- Apply `GEN-SAFE-01` exactly when a suppression appears.

## Core Rules Summary

### Correctness and Security (CRV-CORR)

- **CRV-CORR-01**: Check behavior, edge cases, null handling, off-by-one errors, and concurrency hazards before approval.
- **CRV-CORR-02**: Check input validation, injection, authentication, authorization, exposure, and XSS before approval.
- **CRV-CORR-03**: For each suppression, require explicit user approval, an adjacent root-cause-attempt note, and the narrowest scope under canonical `GEN-SAFE-01`.

### Prioritization and Depth (CRV-PRIO)

- **CRV-PRIO-01**: Order findings by impact: security/correctness, performance/architecture, maintainability/testing, then style.
- **CRV-PRIO-02**: Scale review depth from detailed line review to architecture-first analysis as size and risk grow; hotfixes still require security and correctness review.

### Feedback and Collaboration (CRV-FDBK)

- **CRV-FDBK-01**: Make feedback specific, evidence-backed, respectful, and actionable.
- **CRV-FDBK-02**: Update conclusions when evidence changes and invite challenge to expose blind spots.

## Patterns

### Review Focus

Check these areas in order, without treating later areas as optional:

| Priority | Focus | Typical evidence |
|---|---|---|
| Critical | Correctness and security | Failing edge case, race, injection, missing authorization |
| Important | Performance and architecture | N+1 query, leak, unnecessary O(n²), misplaced responsibility |
| Important | Maintainability and testing | Unclear naming, duplicated responsibility, missing failure tests |
| Optional | Style | A non-blocking readability preference not owned by another rule |

Use efficient structures where the evidence warrants them, such as a `Map` for repeated keyed lookup, and request tests for error scenarios including not-found responses, network failures, and malformed data.

### Suppression Review

`universal/rules/gen-safe-01.md` is authoritative. For every `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, or equivalent:

1. Confirm explicit user approval for that suppression in durable evidence such as a PR discussion, linked issue, or adjacent approving-decision reference.
2. Confirm an adjacent comment records the attempted root-cause fix and why it was blocked.
3. Confirm the scope is minimal; reject file-wide suppression when a narrower form works.
4. If either approval or the root-cause note is absent, block. A comment alone never satisfies `GEN-SAFE-01`.

Prefer a declaration for an untyped library:

```typescript
declare module "legacy-lib" {
  export function process(data: unknown): ProcessResult;
}
```

### Actionable Feedback

Use `[classification]: [problem] + [solution] + [context]` in internal review notes:

```text
issue: This query interpolates user input. Parameterize the id to prevent SQL injection.
suggestion: Extract this validation so both endpoints enforce the same contract.
nit: Consider destructuring here for readability.
question: Is the second sort intentional?
praise: The boundary validation covers malformed payloads clearly.
```

GitHub review comments use the rendered marker taxonomy owned by `../../skills/pr/references/review-tone.md`, not these literal prefixes.

### Review Depth

1. Under 100 lines: perform a detailed line-by-line review.
2. From 100 through 500 lines: inspect key risk areas, then review line by line if no key issue stops the review.
3. Above 500 lines: review architecture first, then key risks, then lines if no earlier blocker stops the review.
4. For a hotfix: focus on security and correctness while checking that the constrained scope is justified.

## Anti-Patterns

- Defending code because it currently works after evidence exposes a defect.
- Flooding a review with formatting notes while material risk remains.
- Critiquing the author rather than the code and its impact.
- Accepting an unapproved suppression because its comment sounds reasonable.

## Quick Decision Tree

1. Is there a correctness or security defect? Block with evidence and a concrete remedy (`CRV-CORR-01`, `CRV-CORR-02`).
2. Is there a suppression? Apply `GEN-SAFE-01` before proceeding (`CRV-CORR-03`).
3. How large and risky is the change? Select the corresponding review depth (`CRV-PRIO-02`).
4. Are important concerns resolved? Then cover maintainability, testing, and optional style (`CRV-PRIO-01`).
5. Is each comment respectful and actionable, and has contrary evidence been incorporated (`CRV-FDBK-01`, `CRV-FDBK-02`)?
