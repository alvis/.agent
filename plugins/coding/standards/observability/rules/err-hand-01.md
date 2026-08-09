# ERR-HAND-01: Use Specific Error Classes

## Intent

Model failures with domain-specific error classes instead of generic `Error` whenever context matters.

## Fix

```typescript
if (!workspace) {
  throw new MissingDataError("workspace not found");
}
```

### Specific error class with context

```typescript
import { MissingDataError } from "@theriety/error";

class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
  ) {
    super(message);
  }
}

if (!user) {
  throw new MissingDataError("User not found");
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `throw new Error("not found")` or ❌ `throw new Error('User not found')`, refactor before adding new behavior.
- Use specific error classes for different failure scenarios (validation, authorization, missing data, external service).

## Related

ERR-HAND-02, ERR-HAND-03
