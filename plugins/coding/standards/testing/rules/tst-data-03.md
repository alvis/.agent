# TST-DATA-03: Use Factories Only for Real Variations

## Intent

No zero-argument factories or constructor wrappers. Use factories only when multiple valid variants are required.

## Fix

**Before:**
```typescript
const createDefaultUser = () => ({ id: "user-1", name: "John" });
const mk = () => new Service();
```

**After:**
```typescript
const createUser = (o?: Partial<User>) => ({ ...baseUser, ...o });
```

## Factory Functions

Factory functions add complexity and must justify their existence:

- **No zero-parameter factories or constructor wrappers** - Use `const` for data, direct instantiation for classes
- **Must be called with different parameters** - If always same params, use `const`
- **Date.now() doesn't justify a factory** - Freeze time with `vi.setSystemTime()`
- **Use const arrow function syntax** when justified

```typescript
// ✅ CORRECT: factory with meaningful variations
const createUser = (overrides?: Partial<User>): User => ({
  id: `user-${Date.now()}`,
  email: 'test@example.com',
  name: 'Test User',
  ...overrides,
});

// Usage justifies existence:
const adminUser = createUser({ role: 'admin' });
const regularUser = createUser({ role: 'user' });
```

```typescript
// ❌ VIOLATION: zero-parameter factory
const createDefaultUser = () => ({
  id: 'user-1',
  name: 'John',
  email: 'john@example.com',
});
// use const DEFAULT_USER = { ... } instead

// ❌ VIOLATION: factory always called without parameters
createUser(); // if always called this way, use const

// ❌ VIOLATION: Date.now() doesn't justify factory
const createTimestampedUser = () => ({
  id: `user-${Date.now()}`,
  name: 'Test',
});
// use vi.setSystemTime() for deterministic tests instead

// ❌ VIOLATION: wrapping constructor in arrow function
const createScreenCapture = () => new ScreenCapture();
// use `const screenCapture = new ScreenCapture()` instead

// ❌ VIOLATION: passing undefined to factory overrides
const session = createMockSession({
  expires_at: undefined as unknown as number,
});
// omit undefined fields — or drop the arg if it becomes empty:
const session = createMockSession();
```

## Edge Cases

- When existing code matches prior violation patterns such as `const mk = () => new Service()`, refactor before adding new behavior.

## Related

TST-DATA-01, TST-DATA-02, TST-DATA-04
