# TST-CORE-04: Each Test Must Add Unique Value

## Intent

A test is valid only if it adds a new behavior path, branch, or meaningful edge case.

A test's description must match the path it actually exercises; a name that
claims a path the input never reaches adds no unique value.

## Fix

```typescript
it("should return empty list", () => {});
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `it("same case #2", fn)`, refactor before adding new behavior.
- A test whose name claims an input class or path it does not exercise — e.g.
  a test named `'unicode'` fed ASCII-only input — adds no unique value.
  Either change the input to exercise the claimed path, or delete it as a
  duplicate of the path actually covered.

## Related

TST-CORE-01, TST-CORE-02, TST-CORE-03
