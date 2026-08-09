# FUNC-SIGN-04: Safe Destructuring

## Intent

Optional object parameters must be destructured safely using defaults or guarded merging.

## Fix

```typescript
function buildUser(options: UserOptions = {}): User {
  const { name = "unknown", role = "user" } = options;
  return { id: createId(), name, role };
}
```

### Spread Guard for Optional Parameter

```typescript
// ✅ safe - handles undefined options via spread
function processUser(options?: UserOptions): User {
  const { name = "Unknown", role = "user", active = true } = { ...options };
  // safe - handles undefined options
}

// ❌ direct destructuring of an optional parameter - will throw if called with undefined
function processUserBad(options?: UserOptions): User {
  const { name = "Unknown", role = "user" } = options as UserOptions;
  // will throw if called with undefined (no `= {}` default, no spread guard)
}
```

### Destructure with Rename and Nested Patterns

```typescript
// destructure in parameter list
function createUser({ name, email, role = "user" }: CreateUserData): User {
  return {
    id: generateId(),
    name,
    email,
    role,
    createdAt: new Date(),
  };
}

// destructure with rename for clarity
function processOrder({
  items,
  customer: buyer,
  discount = 0,
}: OrderData): ProcessedOrder {
  const total = calculateTotal(items, discount);
  return { items, buyer, total };
}

// nested destructuring
interface Config {
  server: { host: string; port: number };
  database: { url: string };
}

function initialize({
  server: { host, port },
  database: { url },
}: Config): void {
  startServer(host, port);
  connectDatabase(url);
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `const {a} = maybeOpts` or ❌ `function run({ id }: Options | undefined) {}`, refactor before adding new behavior.
- Direct destructuring of a possibly-undefined parameter will throw at runtime; always use `= {}` default or spread guard.

## Related

FUNC-SIGN-01, FUNC-SIGN-02, FUNC-SIGN-03, TYP-PARM-01
