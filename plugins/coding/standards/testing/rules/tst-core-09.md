# TST-CORE-09: Assert Log Output via `mock.calls`

## Intent

When a unit's observable behavior includes writing to a logger, the test MUST capture the logger as a typed `vi.fn<LogFn>()` (or `{ info: vi.fn<Logger['info']>(), ... } satisfies Partial<Logger>`) and assert the **full call record** via `expect(log.mock.calls).toEqual([...])` — the array pins both how many lines were logged and each line's exact content. This replaces `toHaveBeenCalledTimes(...)` + scattered `toHaveBeenCalledWith(...)` pairs and makes log output a structural contract.

This holds whether the unit logs once (`[[...]]`) or many times — log output is a complete-record contract either way. Never index into the recorded array (`log.mock.calls[N]`); assert the whole array. See TST-DATA-02 for the general boundary across all mocks: bare `toHaveBeenCalledWith(...)` when you only assert that a call happened with given args, `mock.calls.toEqual([...])` when you assert the complete record.

Applies when:

- The logger is the primary observable effect (CLI tools, background workers, audit paths).
- The test covers a "complicated" flow — multi-step, async, or with branch-specific messages.
- The log sequence encodes ordering guarantees (e.g., "connected" before "ready").

## Banned Patterns

```typescript
// ❌ Asserting logs field-by-field (violates TST-DATA-02 too)
expect(log).toHaveBeenCalledWith('connected');
expect(log).toHaveBeenCalledWith('ready');
expect(log).toHaveBeenCalledTimes(2);

// ❌ Only asserting count — ignores content
expect(log).toHaveBeenCalledTimes(2);

// ❌ Untyped mock drops compile-time signature check
const log = vi.fn();

// ❌ Indexing into a recorded call — assert the whole array with toEqual
expect(log.mock.calls[0]![0]).toBe('connected');
```

## Correct Patterns

```typescript
import type { Log } from '#logger';

const log = vi.fn<Log>();

it('should log connect then ready in order', async () => {
  await start({ log });

  expect(log.mock.calls).toEqual([
    ['connected', { host: 'localhost' }],
    ['ready'],
  ]);
});
```

For structured loggers:

```typescript
import type { Logger } from '#logger';

const logger = {
  info: vi.fn<Logger['info']>(),
  error: vi.fn<Logger['error']>(),
} satisfies Partial<Logger>;

it('should emit info then error on partial failure', async () => {
  await process({ logger });

  expect(logger.info.mock.calls).toEqual([['started', { batch: 1 }]]);
  expect(logger.error.mock.calls).toEqual([
    ['item failed', { id: 'x', reason: 'timeout' }],
  ]);
});
```

## Edge Cases

- A single intentional log line is still the full record — assert `expect(log.mock.calls).toEqual([['msg', meta]])`. Bare `expect(log).toHaveBeenCalledWith(...)` is acceptable only when asserting that a specific log occurred without pinning the complete output.
- Logs that are incidental (debug traces not specified by the contract) need not be asserted — do not lock in noise.
- If order is irrelevant, use `expect(log.mock.calls).toEqual(expect.arrayContaining([...]))`.
- Level-specific assertions: assert each method's `.mock.calls` separately rather than merging.
- **Log type source**: prefer the SUT's exported `Log` / `Logger` type. A local `type Log = (msg: string, meta?: object) => void` alias is acceptable **only** when the SUT does not export one; do not define a local alias to bypass importing the real type.

## Related

TST-CORE-06, TST-DATA-02, TST-MOCK-05, TST-MOCK-16
