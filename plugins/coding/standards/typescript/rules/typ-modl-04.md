# TYP-MODL-04: Barrel File Re-Export Strategy

## Intent

In a barrel file (`index.ts`), choose the re-export form based on whether the source is itself a barrel:

- **Source is a barrel** → `export * from '#subpath'`
- **Source is a leaf file** → explicit `export { ... }` and `export type { ... }`

## Fix

```typescript
// ✅ GOOD: barrel → barrel (wildcard via subpath alias)
export * from '#auth';
export * from '#database';

// ✅ GOOD: barrel → leaf (explicit named, code then types)
export { UserService } from './user-service';
export { UserRepository } from './repository';

export type { User, CreateUserInput } from './types';

// ❌ BAD: explicit names when source is a barrel (duplicates its surface area)
export { UserService, UserRepository } from '#auth';

// ❌ BAD: wildcard from a leaf file (leaks internal symbols)
export * from './user-service';
```

## Edge Cases

- A "barrel" is any `index.ts` whose sole purpose is re-exporting
- `export *` covers both code and types; no separate `export type *` needed
- When uncertain whether a target is a barrel, prefer explicit named exports

## Related

TYP-MODL-01, TYP-MODL-03, TYP-IMPT-04
