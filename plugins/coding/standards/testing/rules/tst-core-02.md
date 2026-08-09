# TST-CORE-02: Follow TDD Order

## Intent

Write failing tests before implementation, then implement, then refactor.

## Fix

```typescript
it("should fail first", () => expect(run()).toThrow());
```

## Test-Driven Development (TDD)

- **Test Before Code** - Write type-safe tests before implementing code
- **Follow TDD cycle** - Red → Green → Refactor with TypeScript checking at each step
- **BDD style descriptions** - Use 'should [expected behavior]' format

<IMPORTANT>
**All test descriptions MUST start with 'should'** - This is non-negotiable BDD format.

```typescript
// ✅ CORRECT: starts with 'should'
it('should pass through MIME type', () => { ... });
it('should return empty array', () => { ... });
it('should handle null input', () => { ... });
```

</IMPORTANT>

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `runFeature()`, refactor before adding new behavior.

## Related

TST-CORE-01, TST-CORE-03, TST-CORE-04
