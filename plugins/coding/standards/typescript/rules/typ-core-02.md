# TYP-CORE-02: No `any`

## Intent

`any` is forbidden. Use specific types, `unknown`, generics, or discriminated unions.

## Fix

```typescript
// unknown instead of any for untyped data
function parseJson(input: string): unknown {
  return JSON.parse(input);
}
```

### Discriminated Unions for Multi-Shape Data

```typescript
type Action =
  | { type: "USER_LOGIN"; userId: string }
  | { type: "USER_LOGOUT" }
  | { type: "USER_UPDATE"; userId: string; name: string };

// exhaustive handler with type narrowing
function handleAction(action: Action): void {
  switch (action.type) {
    case "USER_LOGIN":
      console.log(`Login: ${action.userId}`); // userId is known
      break;
    case "USER_LOGOUT":
      console.log("Logout");
      break;
    case "USER_UPDATE":
      console.log(`Update: ${action.name}`); // name is known
      break;
    // ✅ TypeScript error if case is missing!
  }
}
```

### Generics Instead of `any`

```typescript
function firstOrNull<T>(items: T[]): T | null {
  return items[0] ?? null;
}
```

### Handling Unknown Data

- **Does the data come from external sources (API, user input, JSON)?**
  - YES: Use `unknown` type with type guards
  - NO: Use a specific type

- **Do you need to transform the data?**
  - YES: Create a type guard function with validation
  - NO: Just narrow with simple type checks

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `const data: any = payload`, refactor before adding new behavior.
- If external typings use `any`, wrap with a typed adapter or type guard rather than propagating `any`.

## Related

TYP-CORE-01, TYP-CORE-03, TYP-TYPE-06
