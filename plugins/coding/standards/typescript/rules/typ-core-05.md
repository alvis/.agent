# TYP-CORE-05: `const` by Default

## Intent

Use `const` unless reassignment is unavoidable.

## Fix

```typescript
const userId = "user-123";
const config = { apiUrl: "https://api.example.com" };
const users = await fetchUsers();
```

### Functional Approach Instead of Mutation

```typescript
// ✅ GOOD: functional approach instead of mutation
const processedUsers = users.map((user) => ({ ...user, processed: true }));
const validUsers = users.filter((user) => user.isActive);
const total = items.reduce((sum, item) => sum + item.value, 0);

// ✅ GOOD: let only for truly unavoidable reassignment
let buffer: string;
imperativeApiThatRequiresMutation((value) => { buffer = value; });

// ❌ BAD: let when const would work
let baseUrl = "https://api.example.com"; // never reassigned
let userCount = users.length; // never reassigned

// ❌ BAD: unnecessary mutation
let processedUsers = [];
for (const user of users) {
  processedUsers.push({ ...user, processed: true });
}
```

Most accumulation patterns can use `reduce()`, conditionals can use ternary, multi-step transforms can use method chaining.

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `let baseUrl = "https://api"` (never reassigned), refactor before adding new behavior.

## Related

TYP-CORE-01, TYP-CORE-07
