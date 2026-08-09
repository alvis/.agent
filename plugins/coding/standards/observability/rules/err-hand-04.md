# ERR-HAND-04: Cast Caught Errors Immediately

## Intent

In catch blocks, immediately cast `error` to `Error` (via `as Error`) or use a `toError` helper. Never use inline conditional branching (`instanceof Error` if/else or ternary) just to handle the unknown catch type. Never add `v8 ignore`/`c8 ignore` to cover dead else branches.

**An existing `as Error` cast is correct — leave it.** Never rewrite a direct `as Error` cast into `instanceof Error` narrowing, whatever the fallback (`String(error)`, a string literal, `undefined`). Introducing that narrowing during a lint/fix pass is itself the violation.

## Fix

```typescript
// Pattern A: direct cast
} catch (error) {
  const exception = error as Error;
  log(exception.message);
}

// Pattern B: inline cast for cause
} catch (error) {
  throw new DomainError("msg", { cause: error as Error });
}

// Pattern C: toError helper
} catch (error) {
  const exception = toError(error);
  log(exception.message);
}
```

### Banned anti-patterns

```typescript
// WRONG: conditional branching for base Error
} catch (error) {
  if (error instanceof Error) {
    log(error.message);
  } else {
    log(String(error));
  }
}

// WRONG: ternary branching
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
}

// WRONG: v8 ignore to cover dead else branch
} catch (error) {
  if (error instanceof Error) {
    log(error.message);
  /* v8 ignore next */
  } else {
    log(String(error));
  }
}
```

## Edge Cases

- `instanceof SubclassError` (e.g., `instanceof ValidationError`) is allowed for domain error discrimination — the ban only applies to base `Error` class checks.
- When existing code matches prior violation patterns such as `instanceof Error` if/else or ternary branching, refactor to a direct cast before adding new behavior.

## Related

ERR-HAND-01, ERR-HAND-03
