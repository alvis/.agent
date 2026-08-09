# TYP-PARM-02: Explicit Exported Contracts

## Intent

Exported functions with non-trivial input/output must use named interfaces or types. Simple scalar parameters (`id: string`) do not need dedicated types; this rule targets structured objects.

## Fix

```typescript
// ✅ GOOD: exported functions use separate interfaces
export interface UpdateUserOptions {
  name?: string;
  email?: string;
}
export function updateUser(options: UpdateUserOptions) { /* ... */ }

// ✅ GOOD: simple internal functions can use inline types
function processData(options: { data: string; strict?: boolean }) { /* ... */ }
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `export function setUser(p:any){}`, refactor before adding new behavior.

## Related

FUNC-SIGN-05, TYP-PARM-01, TYP-PARM-03
