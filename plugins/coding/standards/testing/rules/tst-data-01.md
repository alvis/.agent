# TST-DATA-01: Keep Shared Fixtures Immutable

## Intent

Use `const` for shared fixtures and avoid mutating shared objects across tests.

## Fix

**Before:**
```typescript
let user = { id: "u1" };
```

**After:**
```typescript
const user = { id: "u1", email: "a@b.c" };
```

## Shared State

```typescript
// ❌ VIOLATION: mutable shared state
let service: UserService;
beforeEach(() => {
  service = new UserService(repo);
});
```

**See**: [Test Structure > Test Data Management](#test-data-management)

## Test Data Management

Use `const` for immutable test data. Place class instances at file or describe level by default. Only create a per-test instance when the test itself will mutate the instance (e.g., calling setters, modifying internal state). Since Vitest auto-resets mocks, mock dependencies are always fresh between tests — there is no need to recreate the instance for mock isolation.

```typescript
// ✅ CORRECT: fresh instances per test
describe('cl:UserService', () => {
  it('should create user with valid data', () => {
    const repository = createMockUserRepository();
    const service = new UserService(repository);
    // ...
  });
});
```

```typescript
// ❌ VIOLATION: mutable shared state with let
describe('fn:processUser', () => {
  let userData = {
    id: '123',
    name: 'John Doe',
    email: 'john@example.com',
  };

  it('should validate user email format', () => {
    userData.email = 'test@example.com'; // mutating shared data
    const result = processUser(userData);
    expect(result.isValid).toBe(true);
  });
});
```

**Instance Placement (default: file-level):**

```typescript
// ✅ DEFAULT: file-level instance — dependencies are auto-reset by Vitest
const screenCapture = new ScreenCapture();

describe('cl:ScreenCapture', () => {
  it('should capture screenshot of primary display', async () => {
    const result = await screenCapture.captureScreen();

    expect(result).toBe('base64-encoded-webp-string');
  });

  it('should throw when capture fails', async () => {
    getSources.mockRejectedValueOnce(new Error('Capture failed'));

    await expect(screenCapture.captureScreen()).rejects.toThrow(ApplicationError);
  });
});
```

```typescript
// ❌ VIOLATION: per-test creation when the test doesn't mutate the instance
describe('cl:ScreenCapture', () => {
  it('should capture screenshot', async () => {
    const screenCapture = new ScreenCapture();
    // ...
  });
  it('should throw when capture fails', async () => {
    const screenCapture = new ScreenCapture(); // redundant — no mutation
    // ...
  });
});
```

**When per-test instances ARE needed:**
- The test mutates the instance itself (e.g., calling setters, changing internal state)
- Constructor takes different arguments per test

```typescript
// ✅ CORRECT: per-test because constructor args vary
it('should use custom config', () => {
  const service = new Service({ timeout: 5000 });
  // ...
});
it('should use default config', () => {
  const service = new Service({ timeout: 30000 });
  // ...
});
```

## Shared Mock Extraction

When the same class is mocked in 3+ test files, extract a canonical mock to `spec/mocks/`:

```typescript
// spec/mocks/logger.ts
export const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} satisfies Partial<Logger>;
```

Each test file imports and can spy or override error paths as needed. This prevents divergent mock definitions across files.

## Edge Cases

- When existing code matches prior violation patterns such as `let user = { id: "u1" }`, refactor before adding new behavior.

## Related

TST-DATA-02, TST-DATA-03, TST-DATA-04
