# TYP-PARM-01: Safe Optional Destructuring

## Intent

Never destructure optional objects directly in signatures without safe defaults or guarded merging. This is the TypeScript-specific application of `FUNC-SIGN-04`.

## Fix

```typescript
// ❌ function processUser({ name, role = 'user' }: UserOptions) {}
interface UserOptions {
  name: string;
  role?: string;
}

// ✅ safe destructuring with defaults
function processUser(options?: UserOptions) {
  const { name, role = 'user' } = { ...options };
}
```

See `FUNC-SIGN-04` for canonical guidance. Named parameter shapes follow
`TYP-TYPE-01`: plain object shapes use `interface`; unions, intersections,
mapped/computed types, function signatures, and tuples use `type`.

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `function run({id}:Opts){}`, refactor before adding new behavior.

## Related

FUNC-SIGN-04, TYP-PARM-02, TYP-PARM-03, TYP-TYPE-01
