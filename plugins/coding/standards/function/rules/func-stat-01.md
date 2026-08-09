# FUNC-STAT-01: Never Mutate Parameters

## Intent

Treat input parameters as immutable.

## Fix

```typescript
function withNormalizedEmail(user: User): User {
  return { ...user, email: user.email.trim().toLowerCase() };
}
```

### Return New Object Instead of Mutating

```typescript
// ❌ BAD: mutating parameters
function processUser(user: User): User {
  user.status = "processed"; // never mutate inputs!
  return user;
}

// ✅ GOOD: return new object
function processUser(user: User): User {
  return { ...user, status: "processed" };
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `user.name = user.name.trim()` or ❌ `user.status = 'processed'; return user;`, refactor before adding new behavior.
- Use `Readonly<T>` or `ReadonlyArray<T>` in parameter types to enforce immutability at the type level.

## Related

FUNC-STAT-02, FUNC-STAT-03, FUNC-STAT-04
