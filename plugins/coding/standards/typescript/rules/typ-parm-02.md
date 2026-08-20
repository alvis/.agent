# TYP-PARM-02: Explicit Exported Contracts

## Intent

Exported functions with non-trivial input/output must use named contracts whose
declaration form follows `TYP-TYPE-01`. Plain object shapes use `interface`;
unions, intersections, mapped/computed types, function signatures, and tuples
use `type`. Simple scalar parameters (`id: string`) do not need dedicated
contracts.

## Fix

```typescript
// ✅ GOOD: exported functions use separate interfaces
export interface UpdateUserOptions {
  name?: string;
  email?: string;
}
export function updateUser(options: UpdateUserOptions) { /* ... */ }

// ✅ GOOD: internal plain object shapes also use interfaces
interface ProcessDataOptions {
  data: string;
  strict?: boolean;
}
function processData(options: ProcessDataOptions) { /* ... */ }
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `export function setUser(p:any){}`, refactor before adding new behavior.

## Related

FUNC-SIGN-05, TYP-PARM-01, TYP-PARM-03, TYP-TYPE-01
