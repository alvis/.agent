# TST-MOCK-12: Set Shared System Time at File or Describe Level

## Intent

Set the shared/default system time at file or `describe` level — not repeated inside individual `it()` blocks. `vi.useFakeTimers()` and `vi.setSystemTime(...)` belong at file or describe scope directly, without `beforeAll` wrappers. Per-test overrides for *different* times are acceptable (same principle as TST-MOCK-04).

## Fix

```typescript
// Before: Repeating system time in each test (WRONG)
it("should process date correctly", () => {
  vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
  const result = processDate();
  expect(result).toBe("2025-01-01");
});
it("should format date correctly", () => {
  vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z")); // same time repeated
  const result = formatDate();
  expect(result).toBe("Jan 1, 2025");
});

// Before: Unnecessary beforeAll/afterAll wrapping (WRONG)
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
});
afterAll(() => {
  vi.useRealTimers();
});

// After: Set at file or describe level directly
vi.useFakeTimers();
vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));

it("should process date correctly", () => {
  const result = processDate();
  expect(result).toBe("2025-01-01");
});
```

## Edge Cases

- Per-test overrides for a *different* time are acceptable — the violation is repeating the same time in every test.
- When existing code matches prior violation patterns such as `it("x", () => vi.setSystemTime(now))`, refactor before adding new behavior.

## Related

TST-MOCK-01, TST-MOCK-02, TST-MOCK-03, TST-MOCK-10
