# TypeScript: Compliant Code Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.
> **Compliance**: Also follow `scan.md` in this directory to avoid violations during writing. When unsure about a specific rule, consult its detailed guidance in `rules/<rule-id>.md`.

## Key Principles

- `any` is forbidden; use specific types, `unknown`, generics, or discriminated unions
- No type-escape casts (`as unknown as`, `as never`) in production code
- Strict import ordering: built-in, third-party, project modules, then type-only imports
- Separate code and type imports; never mix in one statement
- Named exports and named imports by default
- Top-level symbol ordering: imports, re-exports, types, constants, classes, functions
- `const` by default; `let` only when reassignment is unavoidable

## Core Rules Summary

### Core Type Safety (TYP-CORE)

- **TYP-CORE-01**: Use explicit domain typing at API, IPC, file, and network boundaries.
- **TYP-CORE-02**: `any` is forbidden. Use specific types, `unknown`, generics, or discriminated unions.
- **TYP-CORE-03**: No type-escape casts (`as unknown as`, `as never`) in production/runtime paths.
- **TYP-CORE-04**: `@ts-ignore`, `@ts-expect-error`, and lint suppression comments require explicit user approval and a root-cause note. (→ `GEN-SAFE-01`)
- **TYP-CORE-05**: Use `const` unless reassignment is unavoidable.
- **TYP-CORE-06**: Use American spelling for identifiers and documentation in code. (→ `GEN-CONS-02`)
- **TYP-CORE-07**: Use modern language patterns; avoid deprecated constructs like `var`.

### Imports (TYP-IMPT)

- **TYP-IMPT-01**: Import order: built-in (`node:`), third-party, project modules (alias/subpath/relative), then type-only imports, with blank-line separation only (no comment labels above groups).
- **TYP-IMPT-02**: Never mix `type` with runtime imports in one statement. Keep a blank line between code and type imports.
- **TYP-IMPT-03**: `import * as` is forbidden for normal modules. Use named imports.
- **TYP-IMPT-04**: For cross-module imports where alias/subpath mapping exists, use the shortest configured path.
- **TYP-IMPT-05**: Within the same subpath domain, use relative imports (`./`, `../`).
- **TYP-IMPT-06**: Use named imports by default. Default imports only when no named export exists.
- **TYP-IMPT-07**: Use static `import` statements when the module path is statically known. Reserve dynamic `import()` for paths computed at runtime.

### Module Layout (TYP-MODL)

- **TYP-MODL-01**: File order: imports, re-exports, types, constants, classes, functions.
- **TYP-MODL-02**: Within each group, place public/root orchestration before helper/leaf details.
- **TYP-MODL-03**: Use named exports by default. Default exports only when an external contract requires it.
- **TYP-MODL-04**: In barrel files, use `export * from '#subpath'` for barrel sources; use explicit named exports for leaf sources.

### Parameters (TYP-PARM)

- **TYP-PARM-01**: Never destructure optional objects directly in signatures without safe defaults or guarded merging. (→ `FUNC-SIGN-04`)
- **TYP-PARM-02**: Exported functions with non-trivial input/output must use named interfaces or types. (→ `FUNC-SIGN-05`)
- **TYP-PARM-03**: Property ordering: required fields first, optional fields second, callback/function fields last.
- **TYP-PARM-04**: Class dependency contracts (`XXXParams`/`XXXDependencies`/`XXXConfig`) name capabilities, not infrastructure handles. ✅ `Readonly<{ readUserById(id: string): Promise<User>; writeAuditEvent(event: AuditEvent): Promise<void> }>` ❌ `Readonly<{ database: Database; logger: Logger }>`.

### Type System (TYP-TYPE)

- **TYP-TYPE-01**: Use `interface` for object shape contracts; `type` for unions, intersections, mapped types, and computed types.
- **TYP-TYPE-02**: Public interfaces and exported contract types must include compliant JSDoc.
- **TYP-TYPE-03**: Use `readonly` where appropriate and `#field` for runtime-enforced privacy.
- **TYP-TYPE-04**: Constrain generics with meaningful bounds; prefer built-in utility types when they reduce duplication.
- **TYP-TYPE-05**: For expected operational failures, prefer typed result unions over exception-only control flow.
- **TYP-TYPE-06**: Narrow unknown data using guard functions before reading fields.
- **TYP-TYPE-07**: Testing partial-cast chains are test-only and forbidden in production/runtime modules.
- **TYP-TYPE-08**: In catch blocks, cast caught values directly as `Error` (or use an existing project helper); do not defensively narrow with `instanceof Error ? ... : String(...)`.

## Patterns

### Import Ordering

| Category | Example | Separator |
|----------|---------|-----------|
| Built-in | `import { readFile } from 'node:fs/promises'` | blank line after |
| Third-party | `import { z } from 'zod'` | blank line after |
| Project modules | `import { userService } from '#services/user'` | blank line after |
| Type-only | `import type { User } from '#types'` | end |

### Interface vs Type Decision

| Scenario | Use |
|----------|-----|
| Object shape contract, extendable API | `interface` |
| Union, intersection, mapped, computed type | `type` |

### Error Handling Strategy

| Failure Type | Pattern |
|--------------|---------|
| Expected operational failure | Typed result union (`Result<T, E>`) |
| Programmer error / invariant violation | `throw` |
| External unknown input | Validate as `unknown` first |
| Caught exception in catch block | Cast as `Error` directly or use existing helper (e.g. `ensureError`) |

## Anti-Patterns

- Using `any` as a temporary shortcut.
- Fixing type errors with type-escape casts (`as unknown as`, `as never`).
- Mixing type/runtime imports in one statement.
- Using comment labels above import groups (`// Third-party`, `// Internal`, `// Types`) — blank-line separation is sufficient.
- Using default imports when a named import exists for the same symbol.
- Using default exports for general module APIs.
- Using `export * from './leaf-file'` in a barrel (leaks internals).
- Explicitly picking named exports from another barrel (duplicates its surface area).
- Skipping guards at external data boundaries.
- Defensive `instanceof Error` narrowing or `String(error)` inside catch blocks (`TYP-TYPE-08`).
- Dependency types shaped as infrastructure handles (`database`, `logger`, `httpClient`) instead of capabilities (`TYP-PARM-04`).

## Quick Decision Tree

1. Is the value external or uncertain? Validate as `unknown` first (`TYP-CORE-01`, `TYP-TYPE-06`).
2. Need a fast type fix? Never use `any` or type-escape casting (`TYP-CORE-02`, `TYP-CORE-03`).
3. Adding imports? Enforce ordering, type separation, no namespace imports, and named-import preference (`TYP-IMPT-01`, `TYP-IMPT-02`, `TYP-IMPT-03`, `TYP-IMPT-06`).
4. Choosing import path? Subpath for cross-module, relative inside same subpath (`TYP-IMPT-04`, `TYP-IMPT-05`).
5. Exporting module API? Prefer named exports and named contracts (`TYP-MODL-03`, `TYP-PARM-02`).
6. Modeling failures? Use typed result flow for expected failures (`TYP-TYPE-05`).
