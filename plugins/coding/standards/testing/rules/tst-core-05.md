# TST-CORE-05: No Artificial Variations

## Intent

Do not add tests that only vary arbitrary numbers/strings without changing behavior.

## Fix

```typescript
it("should reject negative amount", () => {});
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `tax(10)`, refactor before adding new behavior.

## Related

TST-CORE-01, TST-CORE-02, TST-CORE-03
