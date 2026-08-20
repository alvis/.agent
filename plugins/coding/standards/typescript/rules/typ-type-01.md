# TYP-TYPE-01: Interface vs Type Boundaries

## Intent

Use `interface` for plain object shapes regardless of whether they are public,
exported, private, or local. Use `type` for unions, intersections, mapped
types, computed types, function signatures, and tuples. Shape decides; visibility does not.

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

- Plain object shape? Use `interface`, regardless of visibility.
- Union, intersection, mapped/computed type, function signature, or tuple? Use `type`.
- React component props are the explicit exception defined by `RC-STRUCT-02`:
  use a `type` alias so intersections and React helper types compose consistently.

### Interface Strategy

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

- When existing code matches prior violation patterns such as ❌ `type User = { id: string }`, refactor before adding new behavior.
- Visibility never changes the choice for a plain object shape.
- If the type involves unions, intersections, or mapped types, use `type`.

## Related

TYP-TYPE-02, TYP-TYPE-03, TYP-TYPE-04
