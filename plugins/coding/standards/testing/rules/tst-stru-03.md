# TST-STRU-03: Enforce AAA Spacing and Comment Quality

## Intent

Use Arrange-Act-Assert with blank lines between sections. Comments should explain why, stay concise, and follow lowercase style.

## Fix

```typescript
// Before: No spacing between AAA sections
describe('fn:formatCurrency', () => {
  it('should format currency', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
  });
});

// After: Proper AAA spacing
describe('fn:formatCurrency', () => {
  it('should format number as USD currency', () => {
    const amount = 1234.56;
    const currency: CurrencyCode = 'USD';
    const expected = '$1,234.56';

    const result = formatCurrency(amount, currency);

    expect(result).toBe(expected);
  });
});
```

## Arrange-Act-Assert Pattern

<IMPORTANT>
All tests must follow AAA with proper spacing. **A line space is required between each section.**
</IMPORTANT>

```typescript
describe('fn:formatCurrency', () => {
  it('should format number as USD currency', () => {
    const amount = 1234.56;
    const currency: CurrencyCode = 'USD';
    const expected = '$1,234.56';

    const result = formatCurrency(amount, currency);

    expect(result).toBe(expected);
  });
});
```

```typescript
// ❌ VIOLATION: unclear structure without AAA spacing
describe('fn:formatCurrency', () => {
  it('should format currency', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
  });
});
```

## Comments

```typescript
// ❌ VIOLATION: comment restates the obvious
expect(result.name).toBe('John'); // check that result has name

// ❌ VIOLATION: AAA section comments
// Arrange  <-- blank lines already show structure
const items = [...];
// Act  <-- remove these
const result = fn(items);
// Assert  <-- the structure is self-evident
expect(result).toBe(30);
```

```typescript
// ✅ COMPLIANT: explains why, not what
// retry waits for eventual consistency
await retry(() => expect(state).toBe('ready'));
```

## Edge Cases

- When existing code matches prior violation patterns such as `// Arrange`, refactor before adding new behavior.

## Related

TST-STRU-01, TST-STRU-02, TST-CORE-01
