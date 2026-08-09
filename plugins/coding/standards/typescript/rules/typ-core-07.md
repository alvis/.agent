# TYP-CORE-07: Prefer Modern TypeScript Features

## Intent

Use modern language patterns (`const`, optional chaining, nullish coalescing, template literals). Avoid deprecated constructs like `var`.

## Fix

```typescript
const city = user?.address?.city;
const port = process.env.PORT ?? 3000;
const message = `Welcome ${userName}!`;
```

### ES6+ Features

```typescript
// ✅ GOOD: modern features
const double = (n: number): number => n * 2;
const { name, email } = user;
const message = `Welcome ${name}!`;
const city = user?.address?.city;
const port = process.env.PORT ?? 3000;
```

### Avoid Deprecated Patterns

```typescript
// ❌ BAD: outdated patterns
var name = "John"; // use const
arguments.callee; // deprecated

// ✅ GOOD: modern alternatives
const name = "John";
const args = [...arguments];
```

### Modern TS Patterns

**Exhaustive Checking** with `satisfies`:

```typescript
const config = {
  debug: true,
  port: 3000,
} satisfies ServerConfig;
```

**Const Assertions** to preserve literal types:

```typescript
const permissions = ['read', 'write', 'admin'] as const;
type Permission = (typeof permissions)[number]; // "read" | "write" | "admin"
```

**Template Literal Types**:

```typescript
type ApiEndpoint = `${'GET' | 'POST'} /api/${string}`;
const endpoint: ApiEndpoint = "GET /api/users";
```

**Mapped Types**:

```typescript
type Serialized<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K];
};

type SerializedUser = Serialized<User>;
```

**Async Result Pattern**:

```typescript
type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

async function safeFetch(url: string): AsyncResult<Response, FetchError> {
  // implementation
}
```

**Branded Types**:

```typescript
type UserId = string & { readonly brand: 'UserId' };
function userId(value: string): UserId {
  return value as UserId;
}
```

### Named Exports

```typescript
// ✅ GOOD: named exports
export const userService = new UserService();
export const validateEmail = (email: string): boolean => { /* ... */ };

// ✅ GOOD: re-exports
export { UserRepository } from "./user-repository";
export type { User, CreateUser } from "./types";

// ❌ BAD: default exports (avoid unless required)
export default userService;
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `var total = list.length`, refactor before adding new behavior.
- `arguments` object is deprecated; use rest parameters (`...args`) instead.

## Related

TYP-CORE-05, TYP-CORE-01
