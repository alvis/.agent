# NAM-TYPE-01: No Legacy Type Prefixes

## Intent

MUST NOT use `I`, `T`, `E` prefixes on types, interfaces, or enums. Use meaningful nouns and suffixes only when semantically needed. Hungarian notation and redundant suffixes like `UserInterface` are non-compliant.

## Fix

```typescript
// clean type names without legacy prefixes
interface User { id: string; name: string; email: string; }
type UserId = string & { readonly brand: "UserId" };
enum UserRole { Admin, Editor, Viewer }
```

### Semantic Suffixes When They Add Value

```typescript
interface CreateUserRequest { name: string; email: string; }
type ApiResult<T> = { ok: boolean; value: T };
class ValidationError extends Error { /* ... */ }
```

## Interface and Type Patterns

| Pattern | Usage | Examples |
|---------|-------|----------|
| Domain models | Plain noun | `User`, `Order`, `Product` |
| Request types | `*Request` suffix | `CreateUserRequest`, `UpdateOrderRequest` |
| Response types | `*Response` suffix | `ApiResponse<T>`, `CreateUserResponse` |
| Generic types | Single letter (T, K, V) | `Container<T>`, `Map<K, V>` |
| Union types | Descriptive noun | `UserRole`, `Status`, `ApiResult<T>` |
| Function types | Descriptive | `Validator<T>`, `EventHandler<T>` |

### Disallowed Prefixes

| Disallowed | Use Instead |
|------------|-------------|
| `IUser` | `User` |
| `TUserId` | `UserId` |
| `EUserRole` | `UserRole` |
| `UserInterface` | `User` |

### Choosing Type Constructs

- **Object shape?** -> `interface`
- **Union/alias?** -> `type`
- **Implementation?** -> `class`
- **Constants set?** -> `enum` or const assertion

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `interface IUser {}` or ❌ `type TUserId`, refactor before adding new behavior.
- `UserInterface` as a suffix is also non-compliant; use `User` directly.
- Generic type parameters (`T`, `K`, `V`) are not affected by this rule.

## Related

NAM-TYPE-02, NAM-TYPE-03, NAM-CORE-01, NAM-CORE-02
