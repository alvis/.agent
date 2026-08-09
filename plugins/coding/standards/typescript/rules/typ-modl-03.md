# TYP-MODL-03: Prefer Named Exports

## Intent

Use named exports by default. Default exports are allowed only when an external contract requires it (e.g., Next.js page components).

## Fix

```typescript
// ✅ GOOD: named exports
export const userService = new UserService();
export const validateEmail = (email: string): boolean => { /* ... */ };

// ✅ GOOD: re-exports
export { UserRepository } from "./user-repository";
export type { User, CreateUser } from "./types";

// ❌ BAD: default exports (avoid unless required)
export default userService;
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `export default userService`, refactor before adding new behavior.
- Default exports are acceptable only when an external framework or contract requires it.
- Default export is acceptable — and encouraged — when a file's sole purpose is to expose **one primary symbol**, especially across a set of sibling files that each export the same kind of symbol (e.g., Next.js page/layout components, service operation handlers, route handlers, middleware). This lets consumers import without guessing the exported name.
- In barrel files, `export * from '#subpath'` is preferred when the source is itself a barrel — this is not a violation of this rule. See TYP-MODL-04.

```typescript
// ✅ GOOD: default export for primary symbol in a uniform set
// operations/get-payment-account.ts
export default async function getPaymentAccount(...) { ... }

// operations/set-invoice.ts
export default async function setInvoice(...) { ... }
```

## Related

TYP-MODL-01, TYP-MODL-02, TYP-MODL-04, TYP-IMPT-06
