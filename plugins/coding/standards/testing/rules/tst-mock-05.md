# TST-MOCK-05: Use `satisfies` with Real Module Types for Mock Typing

## Intent

All test doubles must be validated with `satisfies` against **real types derived from the module being mocked** — not generic types like `Record<string, unknown>` or hand-written inline structural types. The `satisfies` check only catches mock-vs-real mismatches when the type argument is the actual module/class type.

## Banned Patterns

```typescript
// ❌ VIOLATION: no satisfies at all
vi.mock('#repo', () => ({ get: vi.fn() }));

// ❌ VIOLATION: Record<string, unknown> accepts anything
vi.mock('#repo', () => ({
  get: vi.fn(),
}) satisfies Record<string, unknown>);

// ❌ VIOLATION: Record<string, ReturnType<typeof vi.fn>> only checks values are mocks
const hoisted = vi.hoisted(() => ({
  run: vi.fn(),
  build: vi.fn(),
}) satisfies Record<string, ReturnType<typeof vi.fn>>);

// ❌ VIOLATION: inline structural type not derived from real module
const hoisted = vi.hoisted(() => ({
  all: { pipe: vi.fn() },
  stdout: '',
  then: vi.fn(),
  catch: vi.fn(),
  finally: vi.fn(),
}) satisfies () => {
  all: { pipe: Mock };
  stdout: string;
  then: unknown;
  catch: unknown;
  finally: unknown;
});

// ❌ VIOLATION: type assertion instead of satisfies
const repo = { get: vi.fn() } as Repo;
```

## Correct Patterns

### Module mock in `vi.mock()`

```typescript
// ✅ CORRECT: Partial<typeof import(...)> references real module shape
vi.mock(
  '@azure/storage-blob',
  () =>
    ({
      BlobServiceClient: class {
        getContainerClient() {
          return {
            getBlockBlobClient: () => ({
              upload: vi.fn(async () => ({ etag: 'etag' })),
              exists: vi.fn(async () => true),
            }),
          };
        }
      },
    }) satisfies Partial<typeof import('@azure/storage-blob')>,
);
```

### Object mock in `vi.hoisted()`

```typescript
import type { Logger } from '#logger';

// ✅ CORRECT: Partial<RealType> from actual import
const logger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}) satisfies Partial<Logger>);
```

### Full type needed (triple pattern)

```typescript
import type { Repository } from '#repo';

// ✅ CORRECT: satisfies validates shape, then bridge narrows to full type
const repo = vi.hoisted(() =>
  ({ get: vi.fn(async () => null) }) satisfies Partial<Repository> as Partial<Repository> as Repository,
);
```

### Classes with `#private` fields

```typescript
import type { SecureStorage } from '#storage';

// ✅ CORRECT: suppress #private field error while keeping real type validation
const storage = {
  get: vi.fn(),
  // @ts-expect-error class mocking with #private fields
} satisfies Partial<SecureStorage>;
```

## What Type Should I Use in `satisfies`?

| Context | Type to use |
|---|---|
| Module mock in `vi.mock()` | `Partial<typeof import("module-path")>` |
| Object/instance in `vi.hoisted()` | `Partial<ImportedType>` (from `import type`) |
| Class instance mock | `Partial<InstanceType<typeof ClassName>>` |
| Full type needed downstream | `satisfies Partial<T> as Partial<T> as T` |
| Class with `#private` fields | `// @ts-expect-error` + `satisfies Partial<T>` |

## Why Weak Types Are Banned

- `Record<string, unknown>` — accepts **any** object; a mock with completely wrong property names passes
- `Record<string, ReturnType<typeof vi.fn>>` — only validates that values are mocks, not that the mock shape matches the real module
- Inline structural types (e.g., `satisfies { get: (key: string) => string | null }`) — hand-written types can diverge from real module types silently; when the real module changes, the mock won't break

The entire purpose of `satisfies` in mock typing is to **fail at compile time** when the mock shape diverges from the real module. Weak types defeat this guarantee.

## Edge Cases

- When existing code uses weak `satisfies` types, refactor to real module types before adding new behavior.
- If a module has no exported type (e.g., only default export), use `Partial<typeof import("module")>` which captures the full module shape including default.
- For third-party libraries where `typeof import(...)` is too complex, import the specific type (`import type { Client } from 'lib'`) and use `Partial<Client>`.

## Related

TST-MOCK-01, TST-MOCK-02, TST-MOCK-03, TST-MOCK-09
