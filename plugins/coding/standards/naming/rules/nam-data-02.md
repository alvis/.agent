# NAM-DATA-02: Relationship-Oriented Map Naming

## Intent

Use `*By*` or `*To*` naming to express lookup relationships in maps and dictionaries. Generic names like `userMap`, `cache`, or `dict` hide the key-value relationship and reduce readability.

## Fix

```typescript
// *By* pattern for keyed lookups
const usersById = new Map<string, User>();
const ordersByCustomerId = groupOrders(orders);
const productsByCategory: Record<string, Product[]> = {};
```

### *To* Pattern for Value Mappings

```typescript
// *To* pattern for value mappings
const statusToLabel: Record<Status, string> = { active: "Active", inactive: "Inactive" };
const errorCodeToMessage = new Map<number, string>();
const currencyToSymbol: Record<string, string> = { USD: "$", EUR: "E" };
```

### Disallowed Generic Names

| Disallowed | Use Instead |
|------------|-------------|
| `userMap` | `userById`, `usersByEmail`, `usersByRole` |
| `cache` | `userCache`, `responseCache`, `queryCacheByKey` |
| `dict` | `errorCodeToMessage`, `statusToLabel`, `idToUser` |

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `const userMap = new Map()`, refactor before adding new behavior.
- Generic names like `cache` or `dict` should be replaced with relationship-oriented names (`userCacheById`, `errorCodeToMessage`).

## Related

NAM-DATA-01, NAM-DATA-03, NAM-DATA-04
