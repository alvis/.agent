# TST-DATA-02: Assert Object/Array Structures as a Whole

## Intent

Use one structural assertion (`toEqual`, `objectContaining`) instead of many per-field assertions.

## Fix

**Before:**
```typescript
expect(result.id).toBe("1");
expect(result.email).toBe("a@b.c");
expect(result.name).toBe("User");
```

**After:**
```typescript
expect(result).toEqual(expect.objectContaining({ id: "u1" }));
```

## Assertion Preferences

- **`.toBe()`** for primitives and reference identity
- **`.toEqual()`** for deep comparisons (objects, arrays)
- **Inline throwing**: `expect(() => fn()).toThrow()`
- **Single assertion per structure**: Don't check fields one by one

## Object and Array Assertions

<IMPORTANT>
When asserting on objects or arrays, use a single assertion that validates the entire structure. Do NOT check individual fields or elements one by one.
</IMPORTANT>

**Object Assertions:**

```typescript
// ✅ CORRECT: single assertion with full object
expect(result).toEqual({
  mime: 'application/octet-stream',
  size: 0,
  lastModified: expect.any(Date),
});

// ✅ CORRECT: partial matching when only some fields matter
expect(result).toEqual(
  expect.objectContaining({
    mime: 'application/octet-stream',
    size: expect.any(Number),
  }),
);
```

**Array Assertions:**

```typescript
// ✅ CORRECT: single assertion with full array
expect(users).toEqual([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
]);

// ✅ CORRECT: array with dynamic values
expect(users).toEqual([
  expect.objectContaining({ name: 'Alice' }),
  expect.objectContaining({ name: 'Bob' }),
]);
```

## Mock Call Assertions

The "assert as a whole" rule extends to spy/mock calls. Pick the form by *what you assert* — not by how many calls there are — and `mock.calls[N]` indexing is never the answer.

| Asserting | Use |
| --- | --- |
| A call happened with given args (count **not** pinned) | `expect(fn).toHaveBeenCalledWith(...)` (or `toHaveBeenNthCalledWith(n, ...)`) |
| The **complete** call record — exact count **and** exact args | `expect(fn.mock.calls).toEqual([...])` — the whole recorded array |
| — | **Never** index a recorded call: `fn.mock.calls[N]` / `fn.mock.results[N]` |

When a test pairs `toHaveBeenCalledTimes(n)` with `toHaveBeenCalledWith(...)`, it is asserting the full call record — collapse both into one `expect(fn.mock.calls).toEqual([...])`. The array length pins the count, each entry pins that call's exact arguments, and the separate `toHaveBeenCalledTimes` becomes redundant. This holds whether the unit is called once (`[[...]]`) or many times. Assert `fn.mock.calls` as a whole with `toEqual`; never reach into it by index (flagged by the `mock-calls-index` scanner — indexing loses the readable matcher and the argument-shape contract).

```typescript
// ❌ Count + args as two assertions — and dropping an argument silently loses coverage
expect(stackReferenceConstructor).toHaveBeenCalledTimes(1);
expect(stackReferenceConstructor).toHaveBeenCalledWith(
  'theriety/deployment-Test/Test',
  { name: 'theriety/deployment-Test/Test' },
);

// ✅ Complete record — one structural assertion (count + every arg)
expect(stackReferenceConstructor.mock.calls).toEqual([
  ['theriety/deployment-Test/Test', { name: 'theriety/deployment-Test/Test' }],
]);

// ❌ Indexing a recorded call
expect(stackReferenceConstructor.mock.calls[0]![0]).toBe(
  'theriety/svc-eu-prod/theriety-alpha',
);

// ✅ Just "called with these args", count not pinned
expect(stackReferenceConstructor).toHaveBeenCalledWith(
  'theriety/svc-eu-prod/theriety-alpha',
);
```

## Edge Cases

- When existing code matches prior violation patterns such as `expect(result.id).toBe("1")`, refactor before adding new behavior.

## Related

TST-DATA-01, TST-DATA-03, TST-DATA-04, TST-DATA-07, TST-CORE-09
