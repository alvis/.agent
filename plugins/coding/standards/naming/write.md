# Naming: Compliant Code Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.
> **Compliance**: Also follow `scan.md` in this directory to avoid violations during writing. When unsure about a specific rule, consult its detailed guidance in `rules/<rule-id>.md`.

## Key Principles

- Names must communicate domain intent at point-of-use; avoid vague placeholders like `data`, `temp`, `value`
- Enforce canonical casing: `camelCase` for functions/variables, `PascalCase` for types/classes, `UPPER_SNAKE_CASE` for exported constants
- Only allowlisted abbreviations: `fn`, `params`, `args`, `id`, `url`, `urn`, `uri`, `meta`, `info`
- Functions start with verbs; data operations use canonical verbs (`Search/List/Get/Set/Drop`)
- Booleans use `is*`, `has*`, `can*`, `should*` prefixes
- Collections use plural names; maps use `*By*` or `*To*` naming
- No legacy type prefixes (`I`, `T`, `E`)
- File names must not repeat words from parent directories; let directory context provide the type
- Class companion types use `<Class>Params` / `<Class>Config` / `<Class>Dependencies`; capability fields use explicit action phrases; `#private` fields on the class mirror the capability name 1:1

## Core Rules Summary

### Core Naming (NAM-CORE)

- **NAM-CORE-01**: Names communicate domain intent at point-of-use; prefer explicit subject + role/action over placeholders.
- **NAM-CORE-02**: Canonical casing by symbol type: `camelCase` for functions/variables, `PascalCase` for types/classes, `UPPER_SNAKE_CASE` for exported global constants.
- **NAM-CORE-03**: Only allowlisted abbreviations: `fn`, `params`, `args`, `id`, `url`, `urn`, `uri`, `meta`, `info`.
- **NAM-CORE-04**: Time and measurement variables include unit suffixes (`timeoutMs`, `intervalSeconds`, `sizeBytes`).
- **NAM-CORE-05**: File names must not repeat a word already expressed by the parent directory. When inside a typed directory, omit the type suffix (`services/user.ts`, not `services/user-service.ts`).

### Function Naming (NAM-FUNC)

- **NAM-FUNC-01**: Functions start with verbs and clearly encode action.
- **NAM-FUNC-02**: Async/promise-returning functions use explicit operation verbs (`fetch`, `load`, `save`, `set`) and do not masquerade as pure local computation.
- **NAM-FUNC-03**: `createX` for one-off creation; `xFactory` only for reusable/stateful factories.
- **NAM-FUNC-04**: Persisted-data operations follow taxonomy: `Search`/`List` for multi-item reads, `Get` for single-item reads, `Set` for create/update/upsert, `Drop` for irreversible deletion.

### Type Naming (NAM-TYPE)

- **NAM-TYPE-01**: No `I`, `T`, `E` legacy type prefixes.
- **NAM-TYPE-02**: Use canonical parameter vocabulary: `params`, `query`, `input`, `options`, `data`, `config`, `context`, `details`, `logger`, `id`. For class constructors, `params` (capability injection) and `config` (durable structural settings) are both canonical. (→ `FUNC-SIGN-03`)
- **NAM-TYPE-03**: Class companion types use `<Class>Params` / `<Class>Config` / `<Class>Dependencies`; capability fields are explicit action phrases; `#private` fields mirror capability names 1:1.

```typescript
// ✅ GOOD
interface SearchIndexDependencies {
  tokenizeSearchQuery(query: string): readonly string[];
}
class SearchIndex {
  readonly #tokenizeSearchQuery: SearchIndexDependencies['tokenizeSearchQuery'];
}

// ❌ BAD
interface SearchIndexDeps { tokenize(query: string): readonly string[]; }
class SearchIndex { readonly #tokenize: SearchIndexDeps['tokenize']; }
```

### Data Naming (NAM-DATA)

- **NAM-DATA-01**: Singular for single entities (`user`, `config`); plural for collections (`users`, `settings`).
- **NAM-DATA-02**: Maps use `*By*` or `*To*` naming to express lookup relationship.
- **NAM-DATA-03**: Booleans use `is*`, `has*`, `can*`, or `should*` prefixes.
- **NAM-DATA-04**: Descriptive iteration identifiers (`user`, `product`, `item`); single-letter only for tiny index loops.

## Patterns

### Casing by Symbol Type

| Symbol Type | Casing | Example |
|---|---|---|
| Functions, methods, variables, local constants | `camelCase` | `getUserById`, `isActive` |
| Types, interfaces, classes, enums | `PascalCase` | `UserService`, `AuthConfig` |
| Exported global constants | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT` |

### Data Operation Verb Taxonomy

| Operation | Verb | Example |
|---|---|---|
| Multi-item read (filtered) | `Search` | `SearchUsers(query)` |
| Multi-item read (all/paginated) | `List` | `ListOrders(page)` |
| Single-item read | `Get` | `GetUser(id)` |
| Create/update/upsert | `Set` | `SetUser(data)` |
| Irreversible deletion | `Drop` | `DropUser(id)` |

### Boolean Prefix Guide

| Prefix | Usage |
|---|---|
| `is*` | State or identity check (`isActive`, `isValid`) |
| `has*` | Presence or ownership check (`hasPermission`, `hasChildren`) |
| `can*` | Capability or permission check (`canEdit`, `canDelete`) |
| `should*` | Conditional logic flag (`shouldRetry`, `shouldCache`) |

## Anti-Patterns

- Generic placeholders with no context (`data`, `temp`, `obj`, `val`) at module/service boundaries.
- Numbered variable names as structure (`user1`, `user2`) instead of arrays/maps.
- Mixed naming models for the same concept in one module.

## Quick Decision Tree

1. Naming a function? Choose an action verb first (`NAM-FUNC-01`).
2. Naming a data operation? Enforce canonical operation verbs (`NAM-FUNC-04`).
3. Naming collections/maps/booleans? Apply structural conventions (`NAM-DATA-01`, `NAM-DATA-02`, `NAM-DATA-03`).
4. Uncertain? Optimize for explicit domain meaning over brevity (`NAM-CORE-01`).
