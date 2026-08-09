# Universal: Compliant Code Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.
> **Compliance**: Also follow `scan.md` in this directory to avoid violations during writing. When unsure about a specific rule, consult its detailed guidance in `rules/<rule-id>.md`.

## Key Principles

- Fix root causes, never suppress diagnostics without explicit user approval
- Keep functions/modules focused on one clear purpose (single responsibility)
- Eliminate duplication by consolidating semantically identical logic
- Wrappers must add concrete value: validation, caching, telemetry, retries, or error normalization
- Match established architecture and style patterns in the codebase
- Profile before optimizing; choose data structures that avoid predictable bottlenecks
- Use American English spelling in symbols, filenames, and comments

## Core Rules Summary

### Safety (GEN-SAFE)

- **GEN-SAFE-01**: No suppression comments (`@ts-ignore`, `eslint-disable`, etc.) without explicit user approval and a root-cause note. (→ TYP-CORE-04)
- **GEN-SAFE-02**: Fix the root defect, not symptoms. No silent catches, blanket retries, or noop fallbacks.
- **GEN-SAFE-03**: Validate and narrow unknown inputs at boundaries (I/O, network, queue, DB, external SDK).

### Design (GEN-DESN)

- **GEN-DESN-01**: Keep functions/modules focused on one clear purpose with coherent boundaries. (→ FUNC-ARCH-01)
- **GEN-DESN-02**: Consolidate duplicated logic into shared utilities when behavior is semantically identical.
- **GEN-DESN-03**: A wrapper must add concrete value: validation, policy enforcement, transformation, caching, telemetry, retries, or error normalization. (→ FUNC-ARCH-03)

### Consistency (GEN-CONS)

- **GEN-CONS-01**: Match established architecture/style before introducing new patterns. One-off changes require explicit migration decision.
- **GEN-CONS-02**: Use American English spelling in symbols, filenames, and comments. (→ TYP-CORE-06)
- **GEN-CONS-03**: Prefer straightforward constructs that optimize maintainability and onboarding.
- **GEN-CONS-04**: Prefer declarative defaults (spread, `??`, parameter defaults, destructuring defaults) over conditional overrides.

### Scalability (GEN-SCAL)

- **GEN-SCAL-01**: Use profiling evidence before introducing optimization complexity.
- **GEN-SCAL-02**: Choose data structures and boundaries that avoid predictable bottlenecks.
- **GEN-SCAL-03**: For complex changes, perform a deliberate "what am I missing" pass before finalizing.

## Patterns

### Root-Cause Resolution

When diagnostics fail, fix the underlying cause rather than suppressing:

```typescript
// Fix the actual type issue
function processData(input: unknown): User {
  if (!isUser(input)) {
    throw new ValidationError("Invalid user data provided");
  }
  return input;
}
```

### Boundary Validation

Validate and narrow unknown inputs at system boundaries:

```typescript
const parsedConfig = configSchema.parse(rawConfig);
startServer(parsedConfig);
```

### Wrapper Value Test

A wrapper is valid only when it adds concrete value:

| Added Value          | Example                                |
|----------------------|----------------------------------------|
| Caching              | Cache lookup before repository call    |
| Validation           | Schema parse before forwarding         |
| Error normalization  | Catch and rethrow domain error         |
| Telemetry            | Duration/metric logging around call    |
| Policy enforcement   | Permission check before action         |

### Declarative Defaults

Use built-in default mechanisms instead of conditional overrides:

```typescript
// object defaults with spread
const headers = { 'Content-Type': 'application/json', ...options?.headers };

// nullish coalescing
const timeout = options?.timeout ?? 3000;

// parameter defaults
function connect(port = 3000): void { /* ... */ }

// destructuring defaults
const { retries = 3, backoff = 1000 } = config;
```

### Pattern Matching

Before introducing a new pattern, inspect nearby code and match the established architecture/style.

## Anti-Patterns

- Suppressing diagnostics to unblock without follow-up.
- Architecture drift from ad-hoc local patterns.
- Unnecessary indirection and abstraction layering.
- Premature generalization of unproven requirements.
- Replacing declarative defaults with conditional imperative logic.
- Optimizing without profiling evidence.

## Quick Decision Tree

1. If diagnostics fail, fix the cause first (`GEN-SAFE-02`).
2. If considering suppression, stop and get explicit user approval (`GEN-SAFE-01`).
3. If adding abstraction, verify measurable value (`GEN-DESN-03`).
4. If changing style/patterns, align with current architecture (`GEN-CONS-01`).
5. If optimizing, provide profiling evidence (`GEN-SCAL-01`).
6. For complex changes, run "what am I missing" check (`GEN-SCAL-03`).
7. If replacing a declarative default with a conditional, revert to the declarative form (`GEN-CONS-04`).
