# TST-COVR-04: Delete Zero-Gain Tests

## Intent

If coverage does not improve and behavior value is duplicated, remove the test.

## Fix

**Before:**
```typescript
it("should process valid user A", fn);
it("should process valid user B", fn); // coverageDelta === 0
```

**After:**
```typescript
// removed duplicate zero-delta test
```

## Edge Cases

- When existing code matches prior violation patterns such as `coverageDelta === 0 // keep`, refactor before adding new behavior.
- Retain a zero-gain test only when it verifies a uniquely critical behavior not captured elsewhere.

## Related

TST-COVR-01, TST-COVR-02, TST-COVR-03
