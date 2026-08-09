# TYP-MODL-02: Root-to-Leaf Symbol Ordering

## Intent

Within each group, place public/root orchestration before helper/leaf details. Order symbols from high-level to low-level based on call hierarchy.

## Fix

```typescript
// root-to-leaf ordering: public orchestrator first, helpers after
export function processUser(user: User): Result {
  const validated = validateUser(user);
  const normalized = normalizeData(validated);
  return formatResult(normalized);
}

// branch: helpers for main API
function validateUser(user: User): ValidatedUser {
  return checkFields(user);
}

function normalizeData(user: ValidatedUser): NormalizedUser {
  return trimFields(user);
}

// leaves: low-level utilities
function checkFields(user: User): ValidatedUser { /* ... */ }
function trimFields(user: ValidatedUser): NormalizedUser { /* ... */ }
function formatResult(user: NormalizedUser): Result { /* ... */ }
```

### Exported Before Private Within Same Group

```typescript
export interface UserService { getById(id: string): Promise<User>; }
export interface UserRepository { find(id: string): Promise<User | null>; }

interface CacheEntry { user: User; expiresAt: number; }
interface QueryState { cursor: string; hasMore: boolean; }
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `function leaf(){}; function root(){}`, refactor before adding new behavior.
- Within a class, order public methods before private methods following the same root-to-leaf principle.

## Related

TYP-MODL-01, TYP-MODL-03
