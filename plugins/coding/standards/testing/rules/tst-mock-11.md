# TST-MOCK-11: Stub Globals and Environment Correctly

## Intent

Use `vi.stubGlobal` and `vi.stubEnv`; rely on config-based automatic restoration.

## Fix

```typescript
// Before: Direct mutation (WRONG)
process.env.API_URL = "https://api.test";

// After: Use vi.stubEnv
vi.stubEnv("API_URL", "https://api.test");
```

## Stubbing Globals and Environment Variables

Use `vi.stubGlobal` and `vi.stubEnv` for global/environment stubs:

```typescript
describe('fn:getApiUrl', () => {
  it('should use custom API URL from environment', () => {
    vi.stubEnv('API_URL', 'https://custom.api.com');

    const result = getApiUrl();

    expect(result).toBe('https://custom.api.com');
  });

  it('should handle missing fetch global', () => {
    vi.stubGlobal('fetch', undefined);

    expect(() => makeRequest()).toThrow('fetch is not available');
  });
});
```

**Note**: With `unstubEnvs: true` and `unstubGlobals: true` in config, stubs are automatically restored after each test.

## Edge Cases

- When existing code matches prior violation patterns such as `process.env.API_URL = "x"`, refactor before adding new behavior.

## Related

TST-MOCK-01, TST-MOCK-02, TST-MOCK-03
