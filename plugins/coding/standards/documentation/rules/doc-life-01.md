# DOC-LIFE-01: Temporary Tags Never Commit

## Intent

Do not commit temporary drafting tags (`TODO`, `FIXME`, `DEBUG`, `TEMP`, `QUESTION`, `IDEA`, `INTENT`). Move unfinished work context to issues/tasks before merge.

## Fix

```typescript
// retry with backoff because partner API is not idempotent for charge requests
await retryWithBackoff(chargePayment, { maxAttempts: 3, baseDelayMs: 250 });
```

```typescript
// edge-case handling deferred to PROJ-1234
const result = processOrder(order);
```

## Temporary Tags Reference

These tags indicate issues that MUST be resolved before committing:

| Tag | Purpose |
|-----|---------|
| `TODO` | pending implementation |
| `FIXME` | known incorrect behavior |
| `DEBUG` | debug-only code to remove |
| `TEMP` | stub implementation to replace |
| `QUESTION` | unresolved design question |
| `IDEA` | speculative improvement |
| `INTENT` | drafting-phase clarification |

```typescript
// ❌ BAD: these must never be committed
// TODO: implement error handling for network failures
// FIXME: this calculation is incorrect for edge cases
// DEBUG: console.log for debugging - remove before commit
// TEMP: stub implementation - replace with real logic
// QUESTION: should we validate email format here?
// IDEA: could optimize this with memoization
// INTENT: clarifies why something is implemented this way
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `// TODO: fix this later`, resolve or move to issue tracking before adding new behavior.
- If work cannot be completed now, move context to issue tracking instead of leaving tags in source comments.
- These tags should trigger pre-commit hooks to prevent accidental commits.

## Related

DOC-LIFE-02, DOC-LIFE-03, DOC-CONT-03
