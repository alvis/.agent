# TST-STRU-05: Async Setup Uses Runner Global Setup + `inject`

## Intent

One-time async setup — starting a server, initialising a database, provisioning an external resource — belongs in the test runner's `globalSetup`, never in `beforeAll`/`afterAll`. The global setup runs once, exposes serializable handles via `project.provide(...)`, and returns its own teardown function. Tests read those handles with `inject(...)` bound to a `const`. Setup must never rely on `let` or mutation.

This is the positive counterpart to `TST-STRU-04`: STRU-04 flags lifecycle hooks; this rule says where async setup goes instead.

> **API note**: there is no `vi.provide` / `vi.inject`. The real API is `project.provide(...)` (inside `globalSetup`) and `inject(...)` imported from `vitest`. For static, non-async constants use the `test.provide` config option instead.

## Fix

```typescript
// ❌ async setup via lifecycle hooks + mutable bindings
let server: Server;
let port: number;
beforeAll(async () => {
  server = await startServer();
  port = server.address().port;
});
afterAll(async () => {
  await server.close();
});
```

```typescript
// ✅ globalSetup.ts — runs once, returns teardown, no let/no hook
import type { TestProject } from 'vitest/node';

export default async function setup(
  project: TestProject,
): Promise<() => Promise<void>> {
  const server = await startServer();

  project.provide('apiPort', server.address().port);

  return async () => {
    await server.close();
  };
}

declare module 'vitest' {
  interface ProvidedContext {
    apiPort: number;
  }
}
```

```typescript
// ✅ vitest.config.ts — wire the global setup in
//    test: { globalSetup: ['./globalSetup.ts'] }
```

```typescript
// ✅ in the spec — inject into a const, no let, no hook
import { inject } from 'vitest';

const apiPort = inject('apiPort');
```

## What Belongs Where

| Need | Location | Reference |
|---|---|---|
| One-time async infra (server start, DB init) | Runner `globalSetup` (returns teardown) | — |
| Serializable handle (port, URL, connection string) | `project.provide(...)` → `inject(...)` | — |
| Static, non-async constants | `test.provide` in `vitest.config.ts` | — |
| Per-file in-process setup | `setupFiles` (runs before every file) | — |
| Live object that can't serialize (client, pool) | Build from the injected handle at file/`describe` level (`const`) | `TST-DATA-05` |
| Mock cleanup | Vitest config, not hooks | `TST-MOCK-10` |

## Why Not `beforeAll`/`afterAll`

Wrapping async setup in `beforeAll`/`afterAll` couples teardown to a single file, forces `let` bindings for the resource handle, and re-provisions infrastructure per file instead of once per run. `globalSetup` runs a single time, owns its teardown via the returned function, and keeps the handle out of mutable file-level state. See `TST-STRU-04`.

## No `let` / No Mutation

`inject()` returns a value — bind it to `const`. There is no setup path that requires reassigning a shared binding; a `let` or post-declaration mutation for setup purposes is a violation (reinforces `TST-DATA-01`).

## Edge Cases

- **Serializable-only**: `provide` values cross a process boundary. Provide a port / URL / connection string — never the live socket, server, or connection object. Reconstruct the client from the handle inside the test file.
- **Integration & e2e**: `*.int.spec.ts` / `*.e2e.spec.ts` use the same pattern. Combine with `TST-CORE-11` — required config that global setup depends on must `throw` at file load so missing config hard-fails.
- **`setupFiles` vs `globalSetup`**: `setupFiles` runs in-process before *every* test file (per-file, repeated). Use it for in-process per-file setup, not one-time async infrastructure. `globalSetup` runs once for the whole run.
- **Library-mandated hooks**: a third-party tool that requires a lifecycle hook remains the documented `TST-STRU-04` exception; it does not override this rule for async infra.

## Related

TST-STRU-04, TST-DATA-01, TST-DATA-05, TST-MOCK-10, TST-CORE-11
