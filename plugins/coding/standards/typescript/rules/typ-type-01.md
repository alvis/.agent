# TYP-TYPE-01: Interface vs Type Boundaries

## Intent

Use `interface` for object shape contracts and extendable APIs. Use `type` for unions, intersections, mapped types, and computed types.

## Fix

```typescript
// ✅ GOOD: interfaces for object shapes
interface User {
  readonly id: string;
  name: string;
  email: string;
}

// ✅ GOOD: types for unions and computed types
type Status = "active" | "inactive" | "pending";
type UserWithStatus = User & { status: Status };
type EventHandler<T> = (event: T) => void;
```

### Choosing Between Interface and Type

- **Do you need object shape composition (extending multiple shapes)?**
  - YES: Use `interface`
  - NO: Continue to next decision

- **Do you need union, intersection, or computed types?**
  - YES: Use `type`
  - NO: Use `interface` (more readable)

- **Is this for a public API/export?**
  - YES: Use `interface` (allows declaration merging)
  - NO: Use `type` (simpler, more flexible)

### Interface Strategy

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

- When existing code matches prior violation patterns such as ❌ `type User = { id: string }`, refactor before adding new behavior.
- If the type needs to be extended or implemented by classes, use `interface`.
- If the type involves unions, intersections, or mapped types, use `type`.

## Related

TYP-TYPE-02, TYP-TYPE-03, TYP-TYPE-04
