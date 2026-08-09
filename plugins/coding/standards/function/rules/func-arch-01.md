# FUNC-ARCH-01: Single Responsibility

## Intent

Each function should have one clear purpose and one primary reason to change.

## Fix

```typescript
function calculateTax(amount: number, rate: number): number {
  return amount * rate;
}

function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}
```

## Function Size and Extraction

- Functions should be under 60 lines (under 30 preferred). Break down complex operations.
- Class methods that don't use `this` should be extracted into standalone functions.
- Avoid side effects: prefer pure functions and `const` over `let` when possible.

```typescript
// extract class methods that don't use `this` into standalone functions
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

## Common Mistakes

1. **Functions doing too much** - `processUserAndSendEmailAndLog()` combines multiple responsibilities. Break into smaller, focused functions.
2. **Modifying parameters** - `user.age = newAge; return user;` mutates input. Return new objects instead (see `FUNC-STAT-01`).
3. **Missing return types** - Unclear function contracts. Always declare explicit return types (see `FUNC-SIGN-01`).

## Quick Reference

| Pattern | Use Case | Example |
|---------|----------|---------|
| Positional | ≤2 required params | `add(a: number, b: number)` |
| Object | ≥3 params or optional | `create(options: CreateOptions)` |
| Pure | Data transformation | `calculate(input): output` |
| Impure | I/O operations | `async save(data): Promise<void>` |

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `function saveAndNotify(){}` or ❌ `processUserAndSendEmailAndLog()`, refactor before adding new behavior.
- Functions should be under 60 lines (under 30 preferred). Break down complex operations.

## Related

FUNC-ARCH-02, FUNC-ARCH-03, FUNC-ARCH-04, FUNC-SIGN-01, GEN-DESN-01
