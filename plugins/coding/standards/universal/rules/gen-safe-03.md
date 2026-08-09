# GEN-SAFE-03: Validate Boundary Inputs

## Intent

Validate and narrow unknown inputs at boundaries (I/O, network, queue, DB, external SDK). Internal function calls between trusted modules do not require boundary validation.

## Fix

```typescript
// schema validation at boundary
function parseMessage(input: unknown): Message {
  return messageSchema.parse(input);
}
```

## Guard Clauses for Boundary Values

```typescript
// ✅ GOOD: validate before use
function calculatePrice(basePrice: number, discount = 0, tax = 0): number {
  if (basePrice < 0) throw new Error("Base price cannot be negative");
  const subtotal = basePrice - (discount * basePrice);
  return subtotal + (tax * subtotal);
}
```

## Type Guard at API Boundary

```typescript
// ✅ GOOD: narrow unknown input before accessing fields
function handleWebhook(payload: unknown): void {
  if (!isWebhookEvent(payload)) {
    throw new ValidationError("Invalid webhook payload");
  }
  // payload is now safely typed as WebhookEvent
  processEvent(payload);
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `const id = input.id` when `input` is `unknown`, refactor before adding new behavior.
- Internal function calls between trusted modules do not require boundary validation.

## Related

GEN-SAFE-01, GEN-SAFE-02, TYP-TYPE-06
