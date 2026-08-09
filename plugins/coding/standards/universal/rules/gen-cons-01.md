# GEN-CONS-01: Match Established Architecture Patterns

## Intent

Follow established architecture and module patterns in the codebase unless a migration is explicitly agreed. Before implementing something new, check existing implementations for similar functionality and follow established conventions.

## Fix

```typescript
// if the codebase uses constructor DI pattern:
class UserService {
  constructor(private readonly repository: UserRepository) {}
  async findById(id: string): Promise<User | null> { /* ... */ }
}

// follow the same pattern for new services
class ProductService {
  constructor(private readonly repository: ProductRepository) {}
  async findById(id: string): Promise<Product | null> { /* ... */ }
}
```

## Pattern Inspection Before Implementation

Before implementing something new:

1. **Check existing implementations** -- look for similar functionality
2. **Follow established conventions** -- use the same patterns (DI, error strategy, file organization)
3. **Maintain consistency** -- don't introduce new patterns without team discussion

```typescript
// ❌ BAD: different pattern without justification
class ProductManager {
  static async getProduct(id: string): Promise<Product | null> { /* ... */ }
}
```

## Critical Violations (Immediate Rejection)

| Violation                    | Example                              |
|------------------------------|--------------------------------------|
| Suppression without approval | `@ts-ignore`, `eslint-disable`       |
| Wrapper without value        | `return repo.find(id)`               |
| British English              | `colour`, `customise`                |
| Pattern mismatch             | Static methods when DI pattern used  |

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `class ProductManager {}` in an area using service/DI patterns, refactor before adding new behavior.
- If change requires a new pattern, treat it as an explicit migration decision and document rollout scope.
- One-off pattern changes require justification; otherwise treat as a violation.

## Related

GEN-CONS-02, GEN-CONS-03, GEN-DESN-01
