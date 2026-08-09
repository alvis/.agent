# TYP-CORE-01: Type Safety at Boundaries

## Intent

Use explicit domain typing at API, IPC, file, and network boundaries. Treat untrusted external values as `unknown` until validated.

## Fix

```typescript
// explicit domain type at boundary
const currency: CurrencyCode = "USD";
const status: OrderStatus = "pending";
```

### Boundary Typing Patterns

```typescript
// ✅ GOOD: explicit type narrowing at boundaries
const currency: CurrencyCode = "USD";

// ❌ BAD: inference allows wrong values
const currency = "USD"; // could be any string
```

### Type Guard at External Boundary

```typescript
function isUser(value: unknown): value is User {
  return typeof value === "object" && value !== null && "id" in value;
}

const payload: unknown = JSON.parse(raw);
if (!isUser(payload)) throw new ValidationError("invalid user payload");
```

### Quick Reference

| Pattern             | Use Case          | Example                                                                          |
|---------------------|-------------------|----------------------------------------------------------------------------------|
| Interface           | Object shapes     | `interface User { id: string; }`                                                 |
| Type                | Unions/computed   | `type Status = "active" \| "inactive"`                                           |
| Unknown             | Unsafe input      | `function parse(input: unknown)`                                                 |
| Type Guard          | Runtime check     | `function isUser(x): x is User`                                                 |
| Result Pattern      | Error handling    | `type Result<T, E> = { success: true; data: T } \| { success: false; error: E }` |
| Discriminated Union | Exhaustive checks | `type Action = { type: 'A' } \| { type: 'B' }`                                  |
| Branded Type        | Type safety       | `type UserId = string & { readonly brand: 'UserId' }`                            |

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `const currency = "USD"`, refactor before adding new behavior.
- Internal values with clear inference do not need redundant annotations; this rule targets boundaries where values cross trust domains.

## Related

TYP-CORE-02, TYP-CORE-03, TYP-TYPE-06
