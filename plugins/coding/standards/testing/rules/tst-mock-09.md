# TST-MOCK-09: No Double Assertions for Mock Types

## Intent

Do not use `as unknown as` for test doubles.

First validate the mock shape with `satisfies Partial<T>`.

## Fix

```typescript
// Before: Double type assertion without validation
const supabaseClient = {} as unknown as SupabaseClient;

// After: Validate with satisfies, then type cast
const supabaseClient = {
  from: vi.fn(),
} satisfies Partial<SupabaseClient>;

fn(supabaseClient as Partial<SupabaseClient> as SupabaseClient);
```

## Test Double Organization

```text
spec/
├── mocks/           # shared mocks across test files
├── fixtures/        # shared test data
└── utilities/       # test utilities and setup
```

- **Inline**: Place at top of test file when only used in that file
- **Shared**: Place in `spec/mocks` or `spec/fixtures` when reused
- **Clean naming**: Use `const user = ...` not `const mockUser = ...` - test context makes it clear these are test doubles

## Edge Cases

- When existing code matches prior violation patterns such as `{} as unknown as BlobClient`, refactor before adding new behavior.
- When `satisfies Partial<T>` fails due to `#private` fields, do **not** fall back to `as unknown as T`. Use `// @ts-expect-error class mocking with #private fields` before the `satisfies` check instead. See `TST-MOCK-05` for the full pattern.

## Related

TST-MOCK-01, TST-MOCK-02, TST-MOCK-03
