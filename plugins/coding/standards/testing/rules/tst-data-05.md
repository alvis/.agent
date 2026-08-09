# TST-DATA-05: Instance Placement Defaults to File/Describe Level

## Intent

Create instances at file/describe level by default. Per-test instances are allowed only when tests mutate instance state or constructor params differ.

## Fix

**Before:**
```typescript
beforeEach(() => svc = new Svc());
// or
it("test", () => {
  const screenCapture = new ScreenCapture(); // redundant per-test creation
});
```

**After:**
```typescript
const service = new UserService();
```

## When to Mock

<IMPORTANT>
**Only mock when the dependency involves:**
1. **IO Operations** - File system, network, database
2. **External Services** - Third-party APIs, cloud services
3. **Behavior Control** - Time/dates, random values, specific error scenarios

**For all other cases, use the real implementation.**
</IMPORTANT>

| Dependency Type             | Mock? | Reason                      |
| --------------------------- | ----- | --------------------------- |
| Database queries            | Yes   | IO, side effects            |
| HTTP/API calls              | Yes   | IO, external service        |
| File system                 | Yes   | IO                          |
| Date/time                   | Yes   | Behavior control            |
| Pure utility functions      | No    | No side effects             |
| Internal business logic     | No    | Part of what you're testing |
| Simple data transformations | No    | Deterministic               |

```typescript
// ❌ VIOLATION: unnecessary mock for pure function
const { formatCurrency } = vi.hoisted(() => ({
  formatCurrency: vi.fn(() => '$90.00'),
}));
// pure functions have no side effects - use real implementation
```

## Edge Cases

- When existing code matches prior violation patterns such as `beforeEach(() => svc = new Svc())`, refactor before adding new behavior.

## Related

TST-DATA-01, TST-DATA-02, TST-DATA-03
