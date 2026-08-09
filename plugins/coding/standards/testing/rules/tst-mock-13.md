# TST-MOCK-13: Ban mock/mocked Identifier Prefixes

## Intent

In test files, identifiers must not start with `mock`. Use semantic names for test doubles and fixtures (for example `userRepository`, `emailGateway`, `clockStub`).

## Fix

```typescript
// Before: Prefixed with "mock"
const mockUserRepo = { findById: vi.fn() };

// After: Semantic name without prefix
const userRepository = { findById: vi.fn() } satisfies Partial<UserRepository>;
```

## Edge Cases

- When existing code matches prior violation patterns such as `const mockUserRepo = {}`, refactor before adding new behavior.

## Related

TST-MOCK-01, TST-MOCK-02, TST-MOCK-03
