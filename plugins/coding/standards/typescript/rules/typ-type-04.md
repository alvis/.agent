# TYP-TYPE-04: Generic Constraints and Utility Types

## Intent

Constrain generics with meaningful bounds and prefer built-in utility types when they reduce duplication.

## Fix

```typescript
// ✅ GOOD: constrained generics
interface Repository<T extends { id: string }> {
  get(id: string): Promise<T | null>;
  save(entity: T): Promise<T>;
}

// ✅ GOOD: conditional types
type ApiResponse<T> = T extends Error
  ? { status: "error"; error: T }
  : { status: "success"; data: T };
```

### Utility Types

```typescript
// ✅ GOOD: use built-in utility types
type CreateUser = Omit<User, "id" | "createdAt">;
type UpdateUser = Partial<Pick<User, "name" | "email">>;
type UserEmail = User["email"];
```

### Advanced Type Patterns

```typescript
// ✅ GOOD: template literal types
type ApiEndpoint = `${'GET' | 'POST'} /api/${string}`;
const endpoint: ApiEndpoint = "GET /api/users";

// ✅ GOOD: mapped types
type Serialized<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K];
};

type SerializedUser = Serialized<User>;
```

### Factory Pattern with Types

```typescript
interface HandlerFactory<T extends Handler> {
  create(options: { path: string; method: string }): T;
}

const apiHandlerFactory: HandlerFactory<ApiHandler> = {
  create({ path, method }) {
    return {
      path,
      method: method as HttpMethod,
      handle: (request) => ({ status: 200, body: {} }),
    };
  },
};
```

### Generic Type Decision

- **Do you need the type parameter in the function/class signature?**
  - YES: Use generics with proper constraints
  - NO: Use wider types or union types

- **Is the generic type used throughout the implementation?**
  - YES: Keep the generic
  - NO: Remove it (over-engineering)

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `interface Repo<T>{get(id:string):T}`, refactor before adding new behavior.

## Related

TYP-TYPE-01, TYP-TYPE-02, TYP-TYPE-03
