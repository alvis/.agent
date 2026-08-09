# Documentation: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

Any single violation blocks submission by default.
If a violation is detected, load the matching rule guide at `./rules/<rule-id>.md` to confirm the violation and follow its fix guidance.

> **During linting**: Only apply a rule's fix if it is a mechanical correction — formatting, naming, documentation, casing, import ordering, or field/function reordering. If the fix would add new logic, change control flow, introduce runtime validation, or alter program behavior, report the violation without fixing it.

> **Scanner-backed rules**: `DOC-FORM-03`, `DOC-CONT-03`, `DOC-CONT-05`, and `DOC-FORM-06` have advisory mechanical scanner support (`plugins/coding/scripts/scanners/`). The scanner surfaces candidates only — always re-verify each hit against the rule guide before flagging.

## Quick Scan

- DO NOT write comments that restate obvious behavior [`DOC-CONT-01`]
- DO NOT add inline comments that provide no value [`DOC-CONT-02`]
- DO NOT leave forbidden comment patterns in source [`DOC-CONT-03`]
- DO NOT ship exported APIs without required docs [`DOC-CONT-04`]
- DO NOT reference standard rule IDs (`DOC-FORM-03`) or group prefixes (`TST-STRU`) inside source-code comments [`DOC-CONT-05`]
- DO NOT start comments with uppercase (use lowercase), except for code/type references (`UserService`) and section headers (`// --- NAME --- //`), such as `// This validates token` [`DOC-FORM-01`]
- DO NOT use one-line JSDoc on functions with params or non-void return, or block comments (`/* */`) for section headers, such as `/** one line */ fn(a)` or `/* USER */` [`DOC-FORM-02`]
- DO NOT write JSDoc prose (function summary, `@returns`, `@throws`, `@example` description, or free `* …` lines) with uppercase first letter or trailing period; must use lowercase third-person verb (`/** validates input */` not `/** Validate input. */`); exception: first word is a code/type/acronym reference [`DOC-FORM-03`]
- DO NOT capitalize `@param` descriptions unless the first word is a type/interface/acronym reference, such as `@param userId unique identifier` not `@param userId User Identifier` [`DOC-FORM-04`]
- DO NOT commit temporary tags [`DOC-LIFE-01`]
- DO NOT leave review-only markers in merged code [`DOC-LIFE-02`]
- DO NOT use persistent tags inconsistently [`DOC-LIFE-03`]
- DO NOT leave comments that drift from implementation [`DOC-LIFE-04`]
- DO NOT use section dividers in trivial structures with fewer than 3 logical groups [`DOC-FORM-05`]
- DO NOT use non-standard or lowercase section names when a standard UPPERCASE name applies [`DOC-FORM-06`]
- DO NOT place IDENTIFIERS after other sections, or RELATIONS/INDEX before other sections; do not leave empty section dividers [`DOC-FORM-07`]

## Rule Matrix

| Rule ID | Violation | Bad Examples |
|---|---|---|
| `DOC-CONT-01` | Comment restates obvious behavior | `// increment i`; `// increment counter by 1` |
| `DOC-CONT-02` | Inline comment is noise | `// set x to 1`; `return user.name; // obvious comment` |
| `DOC-CONT-03` | Forbidden comment pattern present | `// modified by A on 2025-01-10`; `// modified by John on 2024-01-15` |
| `DOC-CONT-04` | Exported API lacks docs | `export interface X {}` |
| `DOC-CONT-05` | Comment references a standard rule ID or group prefix | `// per DOC-FORM-03`; `// ensure TST-STRU-01 compliance`; `/** see RPS-LAYOUT-01 */` |
| `DOC-FORM-01` | Comment starts with uppercase (should be lowercase unless code reference or section header) | `// This validates token`; `// This function handles user authentication` |
| `DOC-FORM-02` | One-line JSDoc on function with params/return, or block comment used for section header | `/** one line */ fn(a)`; `/* USER */` |
| `DOC-FORM-03` | JSDoc prose (summary, `@returns`, `@throws`, `@example`, free `*` lines) uses uppercase or trailing period instead of lowercase third-person verb (exception: first word is a code/type/acronym reference) | `/** Validate token. */`; `/** validate email format */`; `* @returns The user object.`; `* @throws Error if input is invalid.` |
| `DOC-FORM-04` | `@param` description capitalized without type/interface/acronym justification | `@param userId User Identifier`; `@param userId The unique identifier` |
| `DOC-LIFE-01` | Temporary tags committed | `// TODO: fix this later` |
| `DOC-LIFE-02` | Review-only marker left in code | `// REVIEW: revisit this` |
| `DOC-LIFE-03` | Persistent tags used inconsistently | `// NOTE NOTE NOTE` |
| `DOC-LIFE-04` | Comment drifted from implementation | `// returns age` on a function that returns `user.name`; `/** returns user count */ function getActiveUsers(): User[]` |
| `DOC-FORM-05` | Section dividers used in trivial structure with fewer than 3 logical groups | `interface Point { // --- COORDINATES --- // x: number; y: number; }` |
| `DOC-FORM-06` | Non-standard or lowercase section name | `// --- ids --- //` instead of `// --- IDENTIFIERS --- //`; `// --- LOGIN STUFF --- //` instead of `// --- AUTHENTICATION DETAILS --- //` |
| `DOC-FORM-07` | Section ordering violation or empty section divider | IDENTIFIERS not first; RELATIONS not last; `// --- FLAGS --- // (empty)` |
