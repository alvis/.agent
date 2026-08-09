# TST-STRU-04: Lifecycle Hooks Are Review-Worthy By Default

## Intent

Every occurrence of `beforeAll`, `afterAll`, `beforeEach`, or `afterEach` must be inspected. The only sanctioned uses live in `TST-MOCK-04` (non-Vitest history reset, `onTestFailed` diagnostic dump) and `TST-MOCK-10` (configuration-driven cleanup); anything else — data setup, env stubbing, server lifecycle, fixture rebuilds, timer setup — needs to be re-expressed at file/`describe` level, hoisted into a factory, or moved inside the relevant `it()`.

This rule supplements the mock-focused rules; it does not replace them. Use it as the catch-all that forces every lifecycle hook through human judgment.

## Fix

```typescript
// ❌ data setup in beforeEach — rebuild leaks across tests
let user: User;
beforeEach(() => {
  user = createUser({ id: "u1" });
});

// ✅ shared immutable fixture at file/describe level (TST-DATA-01, TST-DATA-05)
const user = createUser({ id: "u1" });

// ❌ server lifecycle wrapped in afterAll — couples teardown to the file
afterAll(() => server.close());

// ✅ teardown via test runner config or per-it() setup
//    move shared resources into describe-level setup or runner globalTeardown
```

## What Belongs Where

| Need | Location | Reference |
|---|---|---|
| Happy-path mock defaults | File or `describe` level | `TST-MOCK-04` |
| Error-path overrides | Inside `it()` | `TST-MOCK-04` |
| Vitest mock cleanup | Vitest config (`mockReset`, `clearMocks`, …) | `TST-MOCK-10` |
| Non-Vitest history reset | `beforeEach` (history-only) | `TST-MOCK-04`, `TST-MOCK-10` |
| `onTestFailed` diagnostic hook | `beforeEach` | `TST-MOCK-04` |
| Fixture data construction | File / `describe` level (immutable) | `TST-DATA-01`, `TST-DATA-05` |
| Per-test fixture mutation | Inline inside `it()` | `TST-DATA-05` |
| System time setup | File / `describe` level | `TST-MOCK-12` |
| Env stub | `vi.stubEnv` at file / `describe` level | `TST-MOCK-11` |
| Server / DB / external resource lifecycle | Runner global setup or describe-level instance | `TST-STRU-05` |

If a hook does not match a sanctioned case in the table, it is a violation.

## Edge Cases

- **Library-mandated hook patterns**: when a third-party tool (e.g. testing-library `cleanup()`) requires a hook, document the dependency inline and treat it as the only allowed exception.
- **Resource pools**: a shared HTTP server or DB connection should live at module/`describe` scope (or the runner's global setup), not inside `beforeAll`/`afterAll` per file. For one-time async provisioning, follow `TST-STRU-05` (`globalSetup` + `project.provide`/`inject`).
- **Random per-test state**: use a factory called inline in `it()` — do not rebuild it via `beforeEach`.
- **Confirming a flagged occurrence is `TST-MOCK-04`/`TST-MOCK-10`-allowed**: if the hook only calls `client.resetHistory()` (or equivalent) or registers `ctx.onTestFailed(...)`, defer to those rules and do not double-flag.

## Related

TST-MOCK-04, TST-MOCK-10, TST-MOCK-12, TST-DATA-01, TST-DATA-05, TST-STRU-03, TST-STRU-05
