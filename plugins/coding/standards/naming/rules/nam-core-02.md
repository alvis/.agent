# NAM-CORE-02: Casing by Symbol Type

## Intent

Enforce canonical casing by symbol type: functions/methods/variables/local constants use `camelCase`; types/interfaces/classes/enums use `PascalCase`; exported global constants use `UPPER_SNAKE_CASE`. Mixed or legacy casing (`user_service`, `User_Name`) is non-compliant.

## Fix

```typescript
// camelCase for functions, variables, local constants
const activeUsers = users.filter((user) => user.isActive);
const taxRate = 0.08;
function validateEmail(email: string): boolean { /* ... */ }
```

## Casing Conventions

| Element | Convention | Examples |
|---------|-----------|----------|
| Functions/Methods | camelCase | `createUser`, `validateEmail`, `fetchData` |
| Variables | camelCase | `userName`, `activeUsers`, `totalCount` |
| Constants (global, exported) | UPPER_SNAKE_CASE | `MAX_RETRY_ATTEMPTS`, `API_BASE_URL` |
| Constants (local) | camelCase | `taxRate`, `defaultTimeout` |
| Types/Interfaces | PascalCase | `User`, `ApiResponse`, `PaymentMethod` |
| Classes | PascalCase | `UserService`, `PaymentProcessor` |
| Enums | PascalCase | `UserRole`, `OrderStatus` |

### PascalCase for Types

```typescript
// PascalCase for types, interfaces, classes, enums
interface UserProfile { displayName: string; }
class PaymentProcessor { /* ... */ }
enum OrderStatus { Pending, Shipped, Delivered }
```

### UPPER_SNAKE_CASE for Exported Constants

```typescript
// UPPER_SNAKE_CASE for exported global constants
export const MAX_RETRY_ATTEMPTS = 3;
export const API_BASE_URL = "https://api.example.com";
export const CACHE_TTL_SECONDS = 3600;
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `const User_Name = "x"` or ❌ `user_service`, refactor before adding new behavior.
- Local constants use `camelCase`, not `UPPER_SNAKE_CASE`.

## Related

NAM-CORE-01, NAM-CORE-03, NAM-CORE-04
