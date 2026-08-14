# TST-MOCK-11: Stub Globals and Environment Correctly

## Intent

Use `vi.stubGlobal` and `vi.stubEnv`; place a test-specific stub at the beginning of the `it()` that needs it and rely on config-based automatic restoration. File scope is permitted only when every test in the file requires the same stub value.

## Fix

```typescript
// Before: Direct mutation (WRONG)
process.env.API_URL = "https://api.test";
globalThis.fetch = fakeFetch;

// After: Use vi.stubEnv
vi.stubEnv("API_URL", "https://api.test");
```

## Stubbing Globals and Environment Variables

Use `vi.stubGlobal` and `vi.stubEnv` for global/environment stubs:

```typescript
describe('fn:getApiUrl', () => {
  it('should use custom API URL from environment', () => {
    // Stubs belong at the beginning of the test that needs them.
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

Do not assign through `process.env`, including quoted bracket access such as `process['env']` or `process["env"]`, or directly mutate global-object members such as `globalThis.fetch`. Do not put test-specific stubs in lifecycle hooks or `describe` setup; file scope is valid only when every test needs the identical stub. With `unstubEnvs: true` and `unstubGlobals: true` in config, stubs are automatically restored after each test.

## Edge Cases

- When existing code matches prior violation patterns such as `process.env.API_URL = "x"`, refactor before adding new behavior.
- A file-level `vi.stubEnv` or `vi.stubGlobal` is compliant when every test in the file requires the same value; otherwise move it into the relevant tests.

## Related

TST-MOCK-01, TST-MOCK-02, TST-MOCK-03
