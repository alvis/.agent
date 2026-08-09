# FUNC-SIGN-01: Explicit Return Types

## Intent

Every function signature MUST declare its return type.

## Fix

```typescript
function getUserById(id: string): Promise<User | null> {
  return userRepository.findById(id);
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function processItems(items: Item[]): ProcessedItem[] {
  return items.map((item) => processItem(item));
}
```

## Return Type Consistency

Functions should have consistent, predictable return types. Avoid mixing `null` and `undefined` returns:

```typescript
// ✅ consistent return types
function findUser(id: string): User | null {
  // always returns User or null, never undefined
}

async function fetchUsers(): Promise<User[]> {
  // always returns array, never null/undefined
  return users || [];
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `function parse(x){ return x }` or ❌ `function getUserById(id: string) {` (no return type), refactor before adding new behavior.
- Arrow functions assigned to typed variables may rely on contextual typing, but exported functions always need explicit return types.

## Related

FUNC-SIGN-02, FUNC-SIGN-03, FUNC-SIGN-04
