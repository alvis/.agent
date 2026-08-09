# Code Review Standards: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

Any single violation blocks submission by default.

## Quick Scan

- DO NOT approve code with unresolved correctness defects, missed edge cases, races, or unsafe null handling [`CRV-CORR-01`]
- DO NOT approve code with unresolved injection, authorization, authentication, data-exposure, or XSS risk [`CRV-CORR-02`]
- DO NOT accept a suppression unless it satisfies the canonical `GEN-SAFE-01` approval, root-cause-note, and minimal-scope requirements [`CRV-CORR-03`]
- DO NOT let style volume obscure security, correctness, performance, architecture, maintainability, or testing concerns [`CRV-PRIO-01`]
- DO NOT choose review depth without considering change size, risk, and whether the change is a hotfix [`CRV-PRIO-02`]
- DO NOT write feedback that attacks a person, lacks evidence or impact, or gives no actionable disposition [`CRV-FDBK-01`]
- DO NOT defend a conclusion after contrary evidence establishes it is wrong or discourage reasoned challenge [`CRV-FDBK-02`]

## Rule Matrix

| Rule ID | Violation | Bad Examples |
|---|---|---|
| `CRV-CORR-01` | Correctness defect approved | Empty input throws unexpectedly; race condition is left unresolved |
| `CRV-CORR-02` | Security defect approved | Interpolated SQL; authorization omitted from a protected operation |
| `CRV-CORR-03` | Non-compliant suppression accepted | `// @ts-ignore`; documented suppression with no explicit user approval |
| `CRV-PRIO-01` | Review effort misprioritized | Dozens of spacing notes while an injection defect remains |
| `CRV-PRIO-02` | Review depth ignores risk or size | Line-by-line review of a 700-line architectural change before boundary analysis |
| `CRV-FDBK-01` | Unconstructive or unactionable feedback | `This code is terrible`; `fix this` |
| `CRV-FDBK-02` | Evidence or challenge rejected | `It works for now, so the race does not matter` |
