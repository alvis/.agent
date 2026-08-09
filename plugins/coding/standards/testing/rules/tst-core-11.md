# TST-CORE-11: No Silent Test Skips on Missing Configuration

## Intent

A test that silently skips when an env var is missing is worse than no test — CI reports green while the behavior is never exercised. Missing config must hard-fail the test run so the gap is visible. `runIf`/`skipIf`/early-return turn integration coverage into a passive opt-in; this rule makes it mandatory.

## Fix

Validate required env at file load and throw if absent:

```typescript
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for fn:fetchUser integration tests");
}

describe("fn:fetchUser", () => {
  it("should return the user row matching the supplied id", async () => {
    const user = await fetchUser({ id: "u1", databaseUrl });
    expect(user).toEqual({ id: "u1", name: "Ada" });
  });
});
```

Forbidden equivalents:

```typescript
// silent skip via runIf
describe.runIf(process.env.TEST_DATABASE_URL)("fn:fetchUser", () => { /* ... */ });

// silent skip via skipIf
it.skipIf(!process.env.TEST_DATABASE_URL)("should return the user row matching the supplied id", () => { /* ... */ });

// silent skip via early return
describe("fn:fetchUser", () => {
  if (!process.env.TEST_DATABASE_URL) return;
  it("should return the user row matching the supplied id", () => { /* ... */ });
});
```

## Edge Cases

- Build-time excludes (vitest `exclude` glob) for platform-incompatible tests are allowed — they're explicit at config level, not runtime skip surfaces.
- Tests that fundamentally cannot exist without an external service belong in `.int.spec.ts` / `.e2e.spec.ts` — the rule still applies; missing creds throw at file load.
- A genuinely optional test (purely informational, never required) should be deleted, not gated.

## Related

TST-CORE-04, TST-COVR-01, TST-COVR-02, TST-MOCK-11
