# FUNC-STAT-02: Immutability by Default

## Intent

Default to immutable transforms (`map`/`filter`/`reduce`, object spread) and return new values. Mutation is allowed only for local performance-critical paths with explicit rationale; do not mutate shared/module-level data by convenience.

## Fix

```typescript
// ✅ immutable array operations
const numbers = [1, 2, 3];
const doubled = numbers.map((n) => n * 2);
const filtered = numbers.filter((n) => n > 1);
const sum = numbers.reduce((acc, n) => acc + n, 0);
```

### Immutable Object Updates

```typescript
function activateUsers(users: User[]): User[] {
  return users.map((user) => ({ ...user, active: true }));
}

const user = { name: "John", age: 30 };
const updated = { ...user, age: 31 };
const withEmail = { ...user, email: "john@example.com" };
```

### When Mutation Is Acceptable

Mutation is acceptable for local performance-critical code with explicit documentation:

```typescript
// ✅ local mutation for performance with large data sets
function processLargeDataSet(items: Item[]): ProcessedItem[] {
  // NOTE: mutating local array for performance with 1M+ items
  const results: ProcessedItem[] = [];

  for (const item of items) {
    if (item.isValid) {
      results.push(processItem(item)); // local mutation OK
    }
  }

  return results;
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `items.push(nextItem)` or ❌ `user.age = 31`, refactor before adding new behavior.
- Allow mutation only when profiling proves benefit, scope is local, and there is explicit documentation explaining why.

## Related

FUNC-STAT-01, FUNC-STAT-03, FUNC-STAT-04
