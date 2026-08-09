# GEN-DESN-02: Eliminate Duplication

## Intent

Consolidate duplicated logic into shared utilities when behavior is semantically identical. Eliminate code duplication through abstraction, but only when the logic is truly the same across call sites.

## Fix

```typescript
// ❌ BAD: duplicated discount logic
function calculateUserDiscount(user: User): number {
  if (user.membershipLevel === "gold") return user.purchaseAmount * 0.2;
  return user.purchaseAmount * 0.1;
}
function calculateOrderDiscount(order: Order): number {
  if (order.membershipLevel === "gold") return order.total * 0.2;
  return order.total * 0.1;
}

// ✅ GOOD: extracted shared logic
function calculateDiscount(amount: number, isPremium: boolean): number {
  return amount * (isPremium ? 0.2 : 0.1);
}
```

## Shared Validation Utilities

```typescript
// ❌ BAD: same email regex in multiple files
// file-a.ts: const isValid = /^[^@]+@[^@]+$/.test(email);
// file-b.ts: const isValid = /^[^@]+@[^@]+$/.test(input.email);

// ✅ GOOD: single shared validator
function isValidEmail(email: string): boolean {
  return /^[^@]+@[^@]+$/.test(email);
}
```

## DRY Through Abstraction

```typescript
// ❌ BAD: repeated logic
function calculateUserDiscount(user: User): number {
  if (user.membershipLevel === "gold") {
    return user.purchaseAmount * 0.2;
  }
  return user.purchaseAmount * 0.1;
}

// ✅ GOOD: extracted common logic
function calculateDiscount(amount: number, isPremium: boolean): number {
  return amount * (isPremium ? 0.2 : 0.1);
}

function calculateUserDiscount(user: User): number {
  return calculateDiscount(user.purchaseAmount, user.membershipLevel === "gold");
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ identical logic in multiple locations, extract before adding new behavior.
- Only consolidate when the logic is semantically identical; similar-looking code with different domain intent should remain separate.

## Related

GEN-DESN-01, GEN-DESN-03, GEN-DESN-04, GEN-CONS-01
