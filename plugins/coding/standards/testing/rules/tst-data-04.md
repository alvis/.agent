# TST-DATA-04: Omit undefined Overrides

## Intent

Do not pass explicit `undefined` in override objects. Omit the field or omit the argument.

## Fix

**Before:**
```typescript
createUser({ role: undefined })
```

**After:**
```typescript
const user = createUser({ role: "admin" });
// or simply:
const user = createUser();
```

## Edge Cases

- When existing code matches prior violation patterns such as `createUser({ role: undefined })`, refactor before adding new behavior.

## Related

TST-DATA-01, TST-DATA-02, TST-DATA-03
