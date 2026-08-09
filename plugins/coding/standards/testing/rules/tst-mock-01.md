# TST-MOCK-01: Mock Only IO/External/Control Dependencies

## Intent

Mock dependencies with side effects or control needs (IO, external services, time/random). Keep pure internal logic real.

## Fix

```typescript
vi.mock("@azure/storage-blob", () => ({ ... }));
```

## Mock Pattern Decision Guide

| Need                           | Pattern    | Location of Mock Returns                          |
| ------------------------------ | ---------- | ------------------------------------------------- |
| Just need mock to return data  | Default    | Inside `vi.mock()` factory                        |
| Need to verify mock was called | vi.hoisted | vi.hoisted, then reference in vi.mock             |
| Need to test error paths       | vi.hoisted | vi.hoisted with mockRejectedValue                 |
| Need both happy path AND spy   | vi.hoisted | vi.hoisted for spied fn, happy returns in factory |

### Default Pattern

Nest all mock code directly inside `vi.mock()`:

```typescript
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

### vi.hoisted Pattern

ONLY when spying on calls or testing error paths:

**All mocks MUST define default happy-path return values with `satisfies Type` or `satisfies Partial<Type>`**

This applies to ALL typed test doubles inside `vi.hoisted()` — not just mock functions (`vi.fn()`), but also data fixtures representing external types (e.g., Electron's `DesktopCapturerSource`, `Display`, `NativeImage`).

Use `vi.hoisted()` ONLY when you need to:

1. **Spy on calls** - Verify mock was called with specific arguments
2. **Test error paths** - ONLY `mockRejectedValue()` or throwing

**Setting `.mockResolvedValue()` or `.mockReturnValue()` inside `it()` blocks for happy paths is FORBIDDEN.**

If you find yourself calling `.mockResolvedValue()` in multiple tests with similar success data, you're missing a default - fix the mock definition instead.

```typescript
import type { BlockBlobClient } from '@azure/storage-blob';

// --- MOCKS --- //

const { upload } = vi.hoisted(() => ({
  upload: vi.fn(async () => ({ etag: 'etag' })),
}) satisfies Partial<BlockBlobClient>);

vi.mock(
  '@azure/storage-blob',
  () =>
    ({
      BlobServiceClient: class {
        getContainerClient = () => ({
          getBlockBlobClient: () =>
            ({ upload }) satisfies Partial<BlockBlobClient>,
        });
      },
    }) satisfies Partial<typeof import('@azure/storage-blob')>,
);

// --- TEST SUITES --- //

describe('fn:uploadToStorage', () => {
  // ✅ ALLOWED: Spying on calls
  it('should upload with correct params', async () => {
    await uploadToStorage('test.txt', Buffer.from('data'));

    expect(upload).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.any(Number),
    );
  });

  // ✅ ALLOWED: Error path testing
  it('should handle upload failure', async () => {
    upload.mockRejectedValue(new Error('Network error'));

    await expect(
      uploadToStorage('test.txt', Buffer.from('data')),
    ).rejects.toThrow('Network error');
  });
});
```

### vi.hoisted Type Alternatives

When using `vi.hoisted()`, you have two options for typing mock objects:

- **Explicit type import**: Use when the type is needed elsewhere in the test file
- **Inline type extraction**: Use `typeof import('...')['Type']` when the type is only needed for the mock

```typescript
// ✅ CORRECT: type imported explicitly (preferred when type used elsewhere)
import type { BlockBlobClient } from '@azure/storage-blob';

const { upload } = vi.hoisted(() => ({
  upload: vi.fn(async () => ({ etag: 'etag' })),
}) satisfies Partial<BlockBlobClient>);

// ✅ CORRECT: inline type extraction (when type not needed elsewhere)
const { upload } = vi.hoisted(() => ({
  upload: vi.fn(async () => ({ etag: 'etag' })),
}) satisfies Partial<typeof import('@azure/storage-blob')['BlockBlobClient']>);
```

## Edge Cases

When existing code matches prior violation patterns such as `vi.mock("#utils/math")`, refactor before adding new behavior.

## Related

TST-MOCK-02, TST-MOCK-03, TST-MOCK-04
