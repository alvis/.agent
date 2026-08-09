# TST-CORE-08: No Dynamic Imports in Tests

## Intent

Avoid `await import(...)` in tests. Keep imports static and predictable.

## Fix

```typescript
import { createUser } from "#services/user";
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `const m = await import("#mod")`, refactor before adding new behavior.

## Related

TST-CORE-01, TST-CORE-02, TST-CORE-03
