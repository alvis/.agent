# TST-MOCK-07: Use Input-Driven Mock Behavior

## Intent

Mock behavior should depend on input arguments, not mutable external scenario flags.

## Fix

```typescript
exists: vi.fn(async (p) => !p.includes("/missing/")),
```

## Mutable Mock State Anti-Pattern

```typescript
// ❌ VIOLATION: mutating external state to control mock behavior
mockScenario.existsReturnsFalse = true;
const result = await storage.exists('any-path.txt');
mockScenario.existsReturnsFalse = false;
```

**CORRECT**: Mock behavior should be based on **input parameters**

```typescript
// ✅ RIGHT: behavior depends on input
exists: vi.fn(async (path: string) => {
  if (path.includes('/missing/')) return false;
  return true;
}),

// In test - path controls behavior
const result = await storage.exists('bucket/missing/file.txt');
expect(result).toBe(false);
```

**Why**:

- Input-based mocks are self-documenting (the test path explains the scenario)
- No cleanup required (no state to reset)
- Test isolation guaranteed
- Easier to debug

## Edge Cases

When existing code matches prior violation patterns such as `scenario.fail = true`, refactor before adding new behavior.

## Related

TST-MOCK-01, TST-MOCK-02, TST-MOCK-03
