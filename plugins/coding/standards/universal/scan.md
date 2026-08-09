# Universal: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

Any single violation blocks submission by default.
If a violation is detected, load the matching rule guide at `./rules/<rule-id>.md` to confirm the violation and follow its fix guidance.

> **During linting**: Only apply a rule's fix if it is a mechanical correction — formatting, naming, documentation, casing, import ordering, or field/function reordering. If the fix would add new logic, change control flow, introduce runtime validation, or alter program behavior, report the violation without fixing it.

## Quick Scan

- DO NOT introduce one-off architecture styles that conflict with nearby established patterns [`GEN-CONS-01`]
- DO NOT use British spelling in code [`GEN-CONS-02`] (→ TYP-CORE-06)
- DO NOT prioritize cleverness over clarity [`GEN-CONS-03`]
- DO NOT replace declarative defaults with conditional imperative logic [`GEN-CONS-04`]
- DO NOT mix unrelated concerns in one function or module [`GEN-DESN-01`] (→ FUNC-ARCH-01)
- DO NOT duplicate logic that should be extracted [`GEN-DESN-02`]
- DO NOT add wrappers that provide no behavioral value [`GEN-DESN-03`] (→ FUNC-ARCH-03)
- DO NOT keep symbols with no consumer — pre-scan with `fallow dead-code --production`, then deep-dive each candidate case by case [`GEN-DESN-04`]
- DO NOT add suppression comments without approval, such as `// @ts-ignore` or `/* eslint-disable */` [`GEN-SAFE-01`] (→ TYP-CORE-04)
- DO NOT patch symptoms instead of fixing root cause, such as `catch { return }` that hides failures [`GEN-SAFE-02`]
- DO NOT access boundary input before validation/narrowing, such as `const id = input.id` when `input` is still `unknown` [`GEN-SAFE-03`]
- DO NOT optimize hot paths without profiling evidence [`GEN-SCAL-01`]
- DO NOT use linear array scans in hot paths when collection size can grow large, such as `users.find((u)=>u.id===id)` on hundreds+ entries [`GEN-SCAL-02`]
- DO NOT skip explicit risk and uncertainty checks for complex changes [`GEN-SCAL-03`]

## Rule Matrix

| Rule ID | Violation | Bad Examples |
|---|---|---|
| `GEN-CONS-01` | Local architecture pattern is ignored | `class ProductManager {}` in an area using service/DI patterns |
| `GEN-CONS-02` | British spelling appears in code | `const colour = "red"`; `interface ColourConfig {` |
| `GEN-CONS-03` | Code prioritizes cleverness over clarity | `return a?b:c?d:e`; `const isValid = !!(user && user.email && +user.age >= 18);` |
| `GEN-CONS-04` | Declarative default replaced with conditional logic | `if (x !== undefined) { headers['Key'] ??= 'value'; }` replacing spread default; `let t; if (...) {...} else { t = 3000; }` replacing `?? 3000` |
| `GEN-DESN-01` | Function/module has mixed concerns | `function saveAndNotify(){ saveUser(); sendEmail(); }` |
| `GEN-DESN-02` | Duplicate logic not extracted | `const y=a+b; const z=a+b`; `function calculateUserDiscount(user: User): number {` |
| `GEN-DESN-03` | Wrapper adds no behavioral value | `return repo.findById(id)`; `function getUser(id: string): Promise<User> {` |
| `GEN-DESN-04` | Symbol has no consumer (dead code) | `export const INLINE_PATTERNS = /.../` with no caller; `const logo = '...'` read by no code |
| `GEN-SAFE-01` | Suppression comment used without approval | `// @ts-ignore`; `// @ts-ignore - types are broken here` |
| `GEN-SAFE-02` | Symptom patched, root cause unresolved | `catch { return }` |
| `GEN-SAFE-03` | Unknown boundary input is not validated before use | `const id = input.id` when `input: unknown`; `const user = payload as User` without guard/schema |
| `GEN-SCAL-01` | Optimization added without profiling | `optimizePath();`; `const cache = new WeakMap(); // "just in case" it's slow` |
| `GEN-SCAL-02` | Non-scalable lookup in hot path | `users.find((u)=>u.id===id)` |
| `GEN-SCAL-03` | No explicit risk/uncertainty check | `deployChange(); // no risk checklist, no rollback plan` |
