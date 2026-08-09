# ERR-HAND-03: Preserve Error Context

## Intent

Error logs must retain cause chain and stack context when available. Always pass `{ cause: originalError }` when wrapping errors and log the full error object or `error.stack`, not just `error.message`.

## Fix

```typescript
action.log.error("failed to sync billing profile", {
  accountId,
  errorMessage: error.message,
  stack: error.stack,
});
```

### Preserve cause chain when rethrowing

```typescript
try {
  await riskyOperation();
} catch (error) {
  const originalError = error as Error;
  const contextualError = new ProcessingError(
    "Failed to process user data",
    { cause: originalError },
  );
  action.log.error("Processing failed", {
    error: contextualError.message,
    originalError: originalError.message,
    stack: originalError.stack,
  });
  throw contextualError;
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `logger.error(error.message)` (drops stack/cause), refactor before adding new behavior.
- Always pass `{ cause: originalError }` when wrapping errors. Always log `error.stack` or the full error object, not just `error.message`.

## Related

ERR-HAND-01, ERR-HAND-02
