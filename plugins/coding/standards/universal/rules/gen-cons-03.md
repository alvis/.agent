# GEN-CONS-03: Clarity Over Cleverness

## Intent

Prefer straightforward constructs that optimize maintainability and onboarding. Write code that is easy to understand; clever or terse patterns that sacrifice readability are non-compliant when a clearer alternative exists.

## Fix

```typescript
// ❌ BAD: clever but unclear
const isValid = !!(user && user.email && +user.age >= 18);

// ✅ GOOD: clear and explicit
function isValidUser(user: User | null): boolean {
  if (!user?.email) return false;
  return Number(user.age) >= 18;
}
```

## Data-Driven Over Hardcoded Branching

```typescript
// ✅ GOOD: configurable and maintainable
const RolePermissions = {
  admin: ["read", "write", "drop", "manage"],
  editor: ["read", "write"],
  viewer: ["read"],
} as const;

function hasPermission(role: string, permission: string): boolean {
  return RolePermissions[role]?.includes(permission) ?? false;
}

// ❌ BAD: hard to maintain chained conditions
function hasPermission(role: string, permission: string): boolean {
  if (role === "admin") return true;
  if (role === "editor" && (permission === "read" || permission === "write")) return true;
  // ... more hardcoded conditions
}
```

## Structure for Easy Modification

```typescript
// ✅ GOOD: cache expensive computations when profiling warrants it
const fibonacci = (() => {
  const cache = new Map<number, number>();
  return function fib(n: number): number {
    if (n <= 1) return n;
    if (cache.has(n)) return cache.get(n)!;

    const result = fib(n - 1) + fib(n - 2);
    cache.set(n, result);
    return result;
  };
})();

// use appropriate data structures
const userIndex = new Map<string, User>(); // O(1) lookup
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `return a?b:c?d:e`, refactor before adding new behavior.
- Nested ternaries, double-negation coercion, and bitwise tricks are non-compliant when a clearer alternative exists.

## Related

GEN-CONS-01, GEN-CONS-02, GEN-CONS-04, GEN-DESN-01
