# TST-MOCK-10: Auto Cleanup Must Be Configured

## Intent

Vitest cleanup options (`mockReset`, `clearMocks`, `restoreMocks`, `unstubEnvs`, `unstubGlobals`) must be enabled in config. Do not call mock/stub cleanup methods (`mockReset()`, `mockClear()`, `mockRestore()`, `mock.reset()`, `client.reset()`, `vi.resetAllMocks()`, `vi.clearAllMocks()`, `vi.restoreAllMocks()`, `vi.unstubAllEnvs()`, or `vi.unstubAllGlobals()`) in a test or lifecycle hook; configured cleanup runs after each test. For non-Vitest mock libraries, do not use full-reset methods that clear behavior defaults — use history-only clears (e.g., `client.resetHistory()`) instead.

## Fix

```typescript
// Before: Manual cleanup in hooks (WRONG)
afterEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());
beforeAll(() => vi.useFakeTimers());
afterAll(() => vi.useRealTimers());

// After: Configure Vitest for automatic cleanup
// vitest.config.ts - REQUIRED
export default defineConfig({
  test: {
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});

// After: Timer setup at file level (no hooks needed)
vi.useFakeTimers();
vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));

// Before: Manual Vitest reset (WRONG)
afterEach(() => {
  service.mockReset();
  vi.clearAllMocks();
});

// After: No manual reset — Vitest config restores mocks after each test

// Before: Library-specific nuclear reset in hook (WRONG)
beforeEach(() => {
  ecr.reset(); // clears all behavior + history, forcing re-setup
  ecr.on(GetAuthorizationTokenCommand).resolves({ authorizationData });
});

// After: History-only clear (OK — keeps behavior defaults)
beforeEach(() => {
  ecr.resetHistory(); // clears call tracking only
});
```

## Mock Cleanup Configuration

Configure Vitest for automatic cleanup. **Never use manual cleanup in hooks.**

```typescript
// vitest.config.ts - REQUIRED
export default defineConfig({
  test: {
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
```

<IMPORTANT>
With proper Vitest configuration, **NEVER call Vitest mock/stub cleanup methods or add manual cleanup in beforeEach/afterEach**. Let Vitest handle cleanup automatically via config. The `mockReset: true` config property is required; a `mockReset()` call is not.
</IMPORTANT>

## Edge Cases

- When existing code matches prior violation patterns such as `afterEach(() => vi.clearAllMocks())` or `afterAll(() => vi.useRealTimers())`, refactor before adding new behavior.

## Related

TST-MOCK-01, TST-MOCK-02, TST-MOCK-03
