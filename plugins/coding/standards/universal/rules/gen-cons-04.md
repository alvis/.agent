# GEN-CONS-04: Prefer Declarative Defaults Over Conditional Overrides

## Intent

Keep default-value logic declarative. When the language provides a built-in mechanism for expressing defaults — object spread, `??`, `||`, parameter defaults, destructuring defaults — use it. Replacing a declarative default with conditional imperative logic (e.g., an `if` block with `??=`) adds complexity without adding clarity.

## Fix

### Object Defaults with Spread

```typescript
// ✅ GOOD: declarative default-then-spread
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  ...options?.headers,
};

// ❌ BAD: conditional override replacing a clear default
const headers: Record<string, string> = { ...options?.headers };
if (options?.headers?.['Content-Type'] === undefined) {
  headers['Content-Type'] ??= 'application/json';
}
```

### Variable Defaults

```typescript
// ✅ GOOD: nullish coalescing
const timeout = options?.timeout ?? 3000;

// ❌ BAD: conditional assignment
let timeout: number;
if (options?.timeout !== undefined) {
  timeout = options.timeout;
} else {
  timeout = 3000;
}
```

### Parameter Defaults

```typescript
// ✅ GOOD: parameter default
function connect(port = 3000): void { /* ... */ }

// ❌ BAD: conditional inside function body
function connect(port?: number): void {
  if (port === undefined) {
    port = 3000;
  }
  // ...
}
```

### Destructuring Defaults

```typescript
// ✅ GOOD: destructuring default
const { retries = 3, backoff = 1000 } = config;

// ❌ BAD: manual conditional defaults
const retries = config.retries !== undefined ? config.retries : 3;
const backoff = config.backoff !== undefined ? config.backoff : 1000;
```

## When Conditionals Are Justified

Conditionals are acceptable when the default depends on a *different* value or involves logic beyond simple substitution:

```typescript
// ✅ OK: default depends on another field
const format = options?.format ?? (options?.legacy ? 'xml' : 'json');

// ✅ OK: side-effect or validation before assignment
if (!headers['Authorization']) {
  headers['Authorization'] = await fetchToken();
}
```

The rule targets only transformations that replace a declarative default with an imperative conditional that reconstructs the same semantics.

## Edge Cases

- When existing code uses a conditional where a declarative default would suffice, refactor to the declarative form before adding new behavior.
- If the default expression has side effects (e.g., function calls, I/O), a conditional may be warranted to avoid unnecessary evaluation — this is not a violation.
- Spread-based defaults (`{ default, ...overrides }`) are idiomatic and intentional; do not split them into conditional assignments.

## Related

GEN-CONS-01, GEN-CONS-03, GEN-DESN-01
