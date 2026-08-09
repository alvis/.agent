# TST-MOCK-15: Reuse Existing Mock Instances in vi.mock Factories

## Intent

When a symbol is already a mock instance (`vi.fn`, spy, or compatible mock), do not wrap it with another `vi.fn` inside `vi.mock` factories.

Re-export the existing mock reference directly.

## Fix

```typescript
// Before: Double-wrapping an existing mock
const { existsSync } = vi.hoisted(() => ({
  existsSync: vi.fn(() => true),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn((...args: unknown[]) => existsSync(...args)),
}));

// After: Re-export the mock directly
const { existsSync } = vi.hoisted(() => ({
  existsSync: vi.fn(() => true),
}));

vi.mock("node:fs", () => ({
  existsSync,
}));
```

## Signs You're Violating Mock Standards

❌ **You're setting the same `.mockResolvedValue()` in multiple tests**
→ Define a default in `vi.hoisted()` or `vi.mock()`

❌ **You have `vi.fn()` with chained `.mockResolvedValue()` or `.mockReturnValue()`**
→ Either add a default return, or remove if unused

❌ **Your mock object has more than 3-4 methods**
→ Likely mocking unused methods; use `satisfies Partial<T>`

❌ **You're copying mock setup between test files**
→ Move shared mocks to `spec/mocks/` with proper defaults

❌ **You're using mutable variables to control mock behavior**
→ Use input-based mock logic instead (path patterns, argument values)

❌ **You're defining a custom interface for your mock (e.g., `interface MockBrowserWindow`)**
→ Use `satisfies Partial<BrowserWindow>` instead — the real type is the source of truth

## Quick Reference

| Test Type   | File Pattern    | Purpose                       |
| ----------- | --------------- | ----------------------------- |
| Unit        | `*.spec.ts`     | Isolated component testing    |
| Integration | `*.int.spec.ts` | Component interaction testing |
| E2E         | `*.e2e.spec.ts` | Full system testing           |

## Edge Cases

- When existing code matches prior violation patterns such as `existsSync: vi.fn((...args: unknown[]) => existsSync(...args))`, refactor before adding new behavior.

## Related

TST-MOCK-01, TST-MOCK-02, TST-MOCK-03
