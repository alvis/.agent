# TST-MOCK-08: Class Mocks Must Use Object.assign

## Intent

When mocking class instances, assign prepared mock objects in constructor via `Object.assign(this, mockObject)`.

## Fix

```typescript
constructor() { Object.assign(this, encoder); }
```

## Class Mocking Pattern

Use constructor hijacking with `Object.assign` to return pre-defined mock instances.

**When mocking classes with instance methods, use `Object.assign(this, mockObject)` in the constructor** instead of manually declaring types and assigning each property. This eliminates the triple-repetition of every method name (hoisted definition, type declaration, constructor assignment).

### Instance Method Mocking

When the class under test creates instances with methods:

```typescript
import type { Constructor } from 'type-fest';

import type { Encoder } from '#encoder';

// --- MOCKS --- //

const { encoder } = vi.hoisted(() => ({
  encoder: {
    encode: vi.fn(async () => Buffer.from('encoded')),
    decode: vi.fn(async () => Buffer.from('decoded')),
  } satisfies Partial<Encoder>,
}));

vi.mock('#encoder', () => ({
  Encoder: class {
    constructor() {
      Object.assign(this, encoder);
    }
  } satisfies Constructor<Partial<Encoder>>,
}));
```

When the type is only needed for the mock (not imported elsewhere), use inline type extraction:

```typescript
const { encoder } = vi.hoisted(() => ({
  encoder: {
    encode: vi.fn(async () => Buffer.from('encoded')),
    decode: vi.fn(async () => Buffer.from('decoded')),
  } satisfies Partial<InstanceType<typeof import('#encoder')['Encoder']>>,
}));

vi.mock('#encoder', () => ({
  Encoder: class {
    constructor() {
      Object.assign(this, encoder);
    }
  } satisfies Constructor<Partial<InstanceType<typeof import('#encoder')['Encoder']>>>,
}));
```

### Violations

```typescript
// ❌ VIOLATION: manually listing every method — scales O(n) with method count
vi.mock('#encoder', () => ({
  Encoder: class {
    public encode: typeof encoder.encode;
    public decode: typeof encoder.decode;

    constructor() {
      this.encode = encoder.encode;
      this.decode = encoder.decode;
    }
  },
}));

// ❌ VIOLATION: using module type for instance mock
const { encoder } = vi.hoisted(() => ({
  encoder: {
    encode: vi.fn(),
  } satisfies Partial<typeof import('#encoder')>,
  // typeof import(...) is { Encoder: typeof Encoder }, not the instance type
}));
```

### Return-Value Hijacking

When the mock class delegates to pre-defined mock objects via methods:

```typescript
const { blobClient } = vi.hoisted(() => ({
  blobClient: {
    upload: vi.fn(),
    download: vi.fn(),
  } satisfies Partial<BlobClient>,
}));

vi.mock(
  '@azure/storage-blob',
  async (importActual) =>
    ({
      ...(await importActual<typeof import('@azure/storage-blob')>()),
      // @ts-expect-error mocking class with #private fields
      BlobServiceClient: class BlobServiceClient
        implements Partial<BlobServiceClient>
      {
        getContainerClient() {
          return { getBlockBlobClient: () => blobClient };
        }
      },
    }) satisfies typeof import('@azure/storage-blob'),
);
```

**Never use**: `as unknown as typeof Class` — bypasses type checking.

```typescript
// ❌ VIOLATION: double assertion bypasses type safety
const blobClient = {} as unknown as BlobClient;
// this compiles but provides zero type checking
```

## Edge Cases

When existing code matches prior violation patterns such as `this.a = mock.a`, refactor before adding new behavior.

## Related

TST-MOCK-01, TST-MOCK-02, TST-MOCK-03
