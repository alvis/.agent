# FUNC-STAT-04: Isolate Side Effects

## Intent

Perform I/O, logging, persistence, and external calls at clear boundaries.

## Fix

```typescript
async function persistUserUpdate(data: UpdateUserData): Promise<void> {
  await userRepository.update(data);
  await auditLogger.record("updated user", { userId: data.id });
}
```

### Utility-Named Functions Stay Pure

Function names suggesting pure computation (e.g., `calculate*`, `format*`, `validate*`) must not contain hidden I/O:

```typescript
// utility function does NOT hide I/O
function calculateDiscount(price: number, tier: string): number {
  const rates: Record<string, number> = { gold: 0.2, silver: 0.1 };
  return price * (rates[tier] ?? 0);
}

// I/O happens at the boundary, not inside helpers
async function applyDiscount(orderId: string, tier: string): Promise<void> {
  const order = await orderRepository.findById(orderId);
  const discount = calculateDiscount(order.price, tier);
  await orderRepository.update({ ...order, discount });
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `function sum(){ db.save() }`, refactor before adding new behavior.
- Function names suggesting pure computation (e.g., `calculate*`, `format*`, `validate*`) must not contain hidden I/O.

## Related

FUNC-STAT-01, FUNC-STAT-02, FUNC-STAT-03
