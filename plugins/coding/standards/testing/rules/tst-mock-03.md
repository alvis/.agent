# TST-MOCK-03: Define Default Happy-Path Returns in Setup

## Intent

All mocks must define sensible default success behavior in `vi.mock()` or hoisted setup using inline `vi.fn(() => value)` or `vi.fn(async () => value)` implementations.

Do not define happy-path defaults with chained `.mockResolvedValue(...)` or `.mockReturnValue(...)`.

## Fix

```typescript
const now = vi.fn(() => new Date("2024-01-01T00:00:00.000Z"));
const upload = vi.fn(async () => ({ etag: "ok" }));
```

## Mock Setup Examples

### Violation: Missing defaults and satisfies

```typescript
// ❌ VIOLATION: combines both problems - no defaults and unused mocks, no use of `satisfies Type` or `satisfies Partial<Type>`
const { emailService } = vi.hoisted(() => ({
  emailService: {
    send: vi.fn(), // no default return!
    sendBatch: vi.fn(), // unused!
    verify: vi.fn(), // unused!
    getStatus: vi.fn(), // unused!
    scheduleDelivery: vi.fn(), // unused!
  },
}));
```

### Violation: Data fixtures missing satisfies

```typescript
// ❌ VIOLATION: data fixtures inside vi.hoisted() missing satisfies
const { source, display } = vi.hoisted(() => ({
  source: {
    id: 'screen:0',
    name: 'Entire Screen',
    display_id: '0',
  },
  display: {
    id: 0,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  },
}));

// ✅ CORRECT: all typed test doubles use satisfies
const { source, display } = vi.hoisted(() => ({
  source: {
    id: 'screen:0',
    name: 'Entire Screen',
    display_id: '0',
  } satisfies Partial<DesktopCapturerSource>,
  display: {
    id: 0,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  } satisfies Partial<Display>,
}));
```

## Mock Setup Decision Guide

When creating a mock, ask these questions:

1. **Will this method be called in tests?**
   - No → Don't include it (use `satisfies Partial<T>`)
   - Yes → Continue to question 2

2. **Do tests need to spy on calls or test error paths?**
   - No → Put mock directly in `vi.mock()` factory with default return
   - Yes → Use `vi.hoisted()` with default return value

3. **What return value should it have?**
   - Define a sensible happy-path default
   - Tests should NOT need to call `.mockResolvedValue()` for normal behavior
   - Only error tests override with `.mockRejectedValue()`

## Default Mock Behavior

Define sensible defaults with conditional logic. Override only for exception testing:

```typescript
const { getConfig } = vi.hoisted(() => ({
  getConfig: vi.fn((url: string): ServiceConfig => {
    switch (url) {
      case 'provider://full/path':
        return { cache: { type: 'disabled' } };
      default:
        throw new Error(`missing mocked url: ${url}`);
    }
  }),
}));

// In tests: only override for error paths
it('should handle config fetch failure', async () => {
  getConfig.mockRejectedValue(new Error('Network error'));
  await expect(processConfig('any')).rejects.toThrow('Network error');
});
```

## Edge Cases

- When existing code matches prior violation patterns such as `const run = vi.fn().mockResolvedValue("ok")`, refactor before adding new behavior.
- Use per-test override only for exceptional/error-path behavior.

## Related

TST-MOCK-01, TST-MOCK-02, TST-MOCK-04
