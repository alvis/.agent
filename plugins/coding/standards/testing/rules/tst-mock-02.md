# TST-MOCK-02: Restrict vi.hoisted Usage

## Intent

Use `vi.hoisted` only when tests need call spying or error-path overrides.

## Fix

```typescript
const { upload } = vi.hoisted(() => ({ upload: vi.fn() }));
```

## Error Testing

```typescript
describe('fn:validateUser', () => {
  it('should throw ValidationError for invalid email', () => {
    const invalidUser = { name: 'John', email: 'invalid-email' };
    expect(() => validateUser(invalidUser)).toThrow('Invalid email format');
  });
});

// Async error testing
await expect(fetchUserData('nonexistent')).rejects.toThrow('User not found');
```

## Edge Cases

- When existing code matches prior violation patterns such as `const h = vi.hoisted(() => ({ x: 1 }))`, refactor before adding new behavior.
- If no shared spy/error override is needed, prefer non-hoisted module mock setup.

## Related

TST-MOCK-01, TST-MOCK-03, TST-MOCK-04
