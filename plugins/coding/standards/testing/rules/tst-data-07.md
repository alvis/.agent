# TST-DATA-07: Assert Errors as a Whole

## Intent

Assert a caught/thrown error in one structural comparison — `expect(error).toEqual(new Error('msg'))` — instead of splitting it across a `toBeInstanceOf` check plus separate `.message` (and `.cause`/`.name`) assertions. vitest's `toEqual` already compares the error's constructor and `message`, so the split adds lines without adding coverage (same principle as TST-DATA-02, specialized to `Error`).

## Fix

**Before — split across several expects:**
```typescript
expect(error).toBeInstanceOf(Error);
expect((error as Error).message).toBe('connection refused');
```

**After — one whole-error assertion:**
```typescript
expect(error).toEqual(new Error('connection refused'));
```

Custom error subclasses work the same way — `toEqual` checks the constructor:
```typescript
expect(error).toEqual(new FetchError('user u1 not found'));
```

## `cause` Is Ignored by `toEqual`

vitest's `toEqual` compares `name` + `message` but NOT `cause`, so a separate `expect(error.cause).toBe(...)` is unnecessary. These two are equal:
```typescript
expect(new Error('hi', { cause: 'x' })).toEqual(new Error('hi')); // ✅ passes
```
If a test genuinely must pin `cause`, assert it explicitly with one extra line — but the default is a single `toEqual(new Error('…'))`.

## Banned Patterns

```typescript
// ❌ instanceof + message split
expect(error).toBeInstanceOf(TypeError);
expect(error.message).toBe('bad input');

// ❌ field-by-field on the error
expect(error.name).toBe('Error');
expect(error.message).toBe('bad input');
```

## Edge Cases

- `toThrow(/regex/)` / `toThrow('substring')` for inline throw assertions stays valid — this rule targets the split assertion of an already-captured error value.
- `instanceof SubclassError` purely for control-flow narrowing (not assertion) is unaffected.

## Related

TST-DATA-01, TST-DATA-02, TST-DATA-03
