# TST-MOCK-16: Do Not Flag Existing `vi.fn<T>()` Type Generics as Violation

## Intent

Typed `vi.fn<T>()` is encouraged when named types are available (e.g., `HttpReply`, `Request`, `Response`). An existing `vi.fn<T>()` type generic must never be removed.

The type generic is not always necessary inside a `satisfies` container because the type can be inferred from the container — but even there, if it is already present, keep it.

## Banned Patterns

```typescript
// ❌ VIOLATION: stripping an existing type generic
// Before: vi.fn<HttpReply>()
const reply = vi.fn();

// ❌ VIOLATION: stripping type generic even inside satisfies
// Before: vi.fn<Logger['info']>()
const logger = vi.hoisted(() => ({
  info: vi.fn(),
}) satisfies Partial<Logger>);
```

## Correct Patterns

```typescript
// ✅ CORRECT: typed vi.fn with named type
const reply = vi.fn<HttpReply>();
const handler = vi.fn<(req: Request) => Response>();

// ✅ CORRECT: untyped vi.fn inside satisfies (type inferred from container)
const logger = vi.hoisted(() => ({
  info: vi.fn(),
}) satisfies Partial<Logger>);

// ✅ ALSO CORRECT: explicit generic inside satisfies — redundant but acceptable
const logger = vi.hoisted(() => ({
  info: vi.fn<Logger['info']>(),
}) satisfies Partial<Logger>);
```

## Edge Cases

- When writing new mocks, typed `vi.fn<T>()` is encouraged but not required if inference covers it.
- When modifying existing mocks, preserve any `vi.fn<T>()` generics already in place.

## Related

TST-MOCK-05
