# TYP-TYPE-08: Catch-Block Error Casting

## Intent

In catch blocks, treat the caught value as `Error` via a direct `as Error` cast — or via a project-provided helper such as `ensureError(exception)` when the codebase already exposes one. Defensive narrowing with `instanceof Error ? ... : String(...)` adds noise without practical benefit in modern runtimes and discourages structured error handling.

> **An existing `as Error` cast is correct — leave it.** Never rewrite a direct `as Error` cast into an `instanceof Error` ternary or if/else, and never introduce such narrowing for the base `Error` type (regardless of the fallback — `String(error)`, a string literal, `undefined`, …). That rewrite is itself the violation; a lint pass must not produce it.

## Fix

```typescript
// ✅ GOOD: direct cast — the canonical fallback
try {
  await doWork();
} catch (exception) {
  const err = exception as Error;
  log.error(err.message, { cause: err });
}
```

### Using a Project Helper

```typescript
// ✅ GOOD: use an existing helper if the codebase or a dependency already exposes one
try {
  await doWork();
} catch (exception) {
  const err = ensureError(exception);
  log.error(err.message, { cause: err });
}
```

> Only use a helper if the codebase already provides one (any name: `ensureError`, `toError`, `asError`, etc.). Do NOT create a helper just to satisfy this rule — the direct `as Error` cast is the canonical fallback.

### Real-World Example

```typescript
async function fetchUser(id: string): Promise<User> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new FetchError(`User ${id} not found`);
    }
    return await response.json();
  } catch (exception) {
    const err = exception as Error;
    log.error("fetchUser failed", { id, message: err.message, cause: err });
    throw err;
  }
}
```

### Anti-Pattern

```typescript
// ❌ BAD: defensive instanceof Error ternary
try {
  await doWork();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  log.error(message);
}

// ❌ BAD: String(error) inside catch
try {
  await doWork();
} catch (error) {
  log.error(String(error));
}
```

## Edge Cases

- **Genuinely untrusted thrown values** (e.g. from `eval`, cross-realm code, or a foreign sandbox) may warrant explicit narrowing. Document the exception inline and prefer a guard function over an inline ternary.
- **Re-throwing without inspection** needs no cast: `} catch (exception) { throw exception; }` is fine.

## Related

TYP-TYPE-05, TYP-CORE-03
