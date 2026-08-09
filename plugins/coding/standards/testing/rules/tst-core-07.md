# TST-CORE-07: No Implementation-Detail Assertions

## Intent

Do not spy on internals (for example React internals) when external behavior can be tested.

## Fix

```typescript
expect(screen.getByText("Saved")).toBeVisible();
```

## Assertions

```typescript
// ❌ VIOLATION: checking fields one by one
expect(result.mime).toBe('application/octet-stream');
expect(result.size).toBe(0);
expect(result.lastModified).toBeInstanceOf(Date);

// ❌ VIOLATION: checking array elements one by one
expect(users[0].name).toBe('Alice');
expect(users[1].name).toBe('Bob');
```

**See**: [Test Structure > Assertions](#object-and-array-assertions)

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `expect(useState).toHaveBeenCalled()`, refactor before adding new behavior.

## Related

TST-CORE-01, TST-CORE-02, TST-CORE-03
