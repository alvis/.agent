# TYP-MODL-03: Restrict Default Exports

## Intent

Use named exports unless a documented external or runtime contract requires a
default export, such as a framework loader that discovers a default-exported
entry point.

## Fix

```typescript
// ✅ GOOD: named exports
export const userService = new UserService();
export const validateEmail = (email: string): boolean => { /* ... */ };

// ✅ GOOD: re-exports
export { UserRepository } from "./user-repository";
export type { User, CreateUser } from "./types";

// ❌ BAD: internal preference is not a contract
export default userService;
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `export default userService`, refactor before adding new behavior.
- Default exports are acceptable only when a documented external framework,
  loader, configuration, or runtime contract requires them. Cite that contract
  in project documentation, configuration, or an adjacent explanatory comment.
- A file having one primary symbol, uniform sibling files, or a preferred import
  spelling is not sufficient.
- In barrel files, `export * from '#subpath'` is preferred when the source is itself a barrel — this is not a violation of this rule. See TYP-MODL-04.

```typescript
// ✅ GOOD: Next.js runtime contract requires a default page component
// pages/account-settings.tsx
export default function AccountSettingsPage(...) { ... }
```

## Related

TYP-MODL-01, TYP-MODL-02, TYP-MODL-04, TYP-IMPT-06
