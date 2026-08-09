# FUNC-ARCH-03: Avoid No-Value Wrappers

## Intent

Do not create pass-through wrappers that add no policy, validation, or transformation. This is the function-design application of `GEN-DESN-03` (canonical wrapper tolerance rule).

## Fix

```typescript
function getUserOrThrow(id: string): Promise<User> {
  return userRepository.findById(id).then((user) => {
    if (!user) throw new MissingDataError("user not found");
    return user;
  });
}
```

### Acceptable Wrappers Add Value

A wrapper is justified only when it adds validation, error mapping, caching, logging, or transformation:

```typescript
// ✅ wrapper adds null-to-throw policy
function findUser(id: string): User | null {
  return userRepository.findById(id) ?? null;
}

// ✅ wrapper adds consistent return type normalization
function findUsers(ids: string[]): Promise<User[]> {
  return userRepository.findByIds(ids).then((users) => users ?? []);
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `return service.run(data)`, refactor before adding new behavior.
- A wrapper is acceptable only if it adds validation, error mapping, caching, logging, or transformation.

## Related

GEN-DESN-03, GEN-DESN-04, FUNC-ARCH-01, FUNC-ARCH-02
