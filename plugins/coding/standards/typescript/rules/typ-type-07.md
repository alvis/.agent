# TYP-TYPE-07: Testing-Only Partial Cast Pattern

## Intent

Testing partial-cast chains (`satisfies Partial<T> as Partial<T> as T` or equivalent) are test-only and limited to mock boundaries that require full-type compatibility. They are forbidden in production/runtime modules and non-test utilities. `as never` is not allowed for mocked-instance or test-double typing in tests.

Use `@ts-expect-error` with a reason comment instead of `satisfies Partial<T> as Partial<T> as T`. The triple-cast pattern remains a documented fallback for cases where `@ts-expect-error` cannot be placed inline.

## Fix

```typescript
const userRepository = {
  findById: vi.fn(),
} satisfies Partial<UserRepository>;

run(userRepository as Partial<UserRepository> as UserRepository);
```

### Testing Patterns (TESTING ONLY)

Two distinct patterns depending on context:

```typescript
// ✅ PREFERRED (inside vi.mock): @ts-expect-error replaces the triple-cast
vi.mock("./user-service", () => ({
  // @ts-expect-error partial mock — unused methods not needed for this test suite
  userService: { getUser: vi.fn() } satisfies Partial<MockedObject<UserService>>,
}));

// ✅ FALLBACK (inside vi.mock): triple-cast when inline comment is not possible
vi.mock("./user-service", () => ({
  userService: {
    getUser: vi.fn(),
  } satisfies Partial<MockedObject<UserService>> as Partial<
    MockedObject<UserService>
  > as MockedObject<UserService>,
}));

// ✅ OUTSIDE vi.mock: unchanged — satisfies Partial<T> is already clean
const mockUser = {
  id: "123",
  name: "Test User",
} satisfies Partial<User>;

function setupTest(user: Partial<User> = mockUser) {
  // ...
}
```

**Why two patterns?**

- **Inside vi.mock**: The module system requires the exact type; prefer `@ts-expect-error` for clarity, triple-cast as fallback
- **Outside vi.mock**: Test code should explicitly handle partial types for accuracy

**NOTE**: These patterns are ONLY allowed in test files. Production code must NEVER use these patterns.

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `const u = {} as unknown as User`, refactor before adding new behavior.
- If full-instance typing is required in tests, bridge from `Partial<T>` to `T` only after structural validation.

## Related

TYP-CORE-03, TYP-TYPE-06, TYP-TYPE-01
