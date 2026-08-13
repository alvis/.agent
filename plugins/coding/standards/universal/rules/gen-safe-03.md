# GEN-SAFE-03: Validate at Trust Boundaries

## Intent

Validate and narrow values at genuine trust boundaries. Do not add or retain a
runtime guard that only reasserts a postcondition of trusted, typed, tested
first-party code. The type system need not express the whole postcondition:
prove it at the producer instead of adding branches and impossible error paths
at every consumer.

## Decision Test

Before adding, retaining, or removing a runtime check, answer all five questions:

1. Where did the value originate?
2. Can code outside the team's typed, tested implementation produce it?
3. Who can violate the condition during supported execution?
4. Is the condition only a postcondition of the trusted producer?
5. Which exact producer test proves that postcondition?

Keep the check for user input, deserialization, network or persistence data,
external SDKs, public plugin or adapter implementations, unsafe code, and other
genuine trust boundaries. Also keep checks for mutable, concurrent, or
security-sensitive state that supported execution can invalidate after a trusted
producer returns. A call between trusted modules does not make external or
persisted data trusted; follow the value's provenance.

Remove a check only when the producer is closed first-party typed and tested
code, no external implementation path exists, supported execution cannot
invalidate the condition independently, and the check only repeats a producer
postcondition. Removal requires an existing producer test for that exact
postcondition; broad coverage is insufficient. If provenance is ambiguous or
the exact test is absent, report the candidate without removing it and route
missing producer coverage through the test-owning workflow.

## Fix

```typescript
// schema validation at boundary
function parseMessage(input: unknown): Message {
  return messageSchema.parse(input);
}
```

For a closed first-party producer, rely on its tested postcondition:

```typescript
const resource = await shippedProvider.create();
return resource;
```

Do not repeat the producer contract at the consumer:

```typescript
const resource = await shippedProvider.create();
validateResource(resource);
return resource;
```

Before removal, trace every producer, caller, registration path, dynamic load,
unsafe cast, and external input. Cite the exact producer test, then remove the
guard and any helper, import, impossible-input test, or error mapping made
unreachable. Preserve producer-contract tests and run focused tests, type checks,
and lint.

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
- An interface is not automatically trusted; retain validation when callers can
  register implementations or load them dynamically.
- Package-private injection of a closed set of shipped adapters remains trusted
  when no public or external construction path exists and the exact
  postcondition has a producer test.
- A custom error or redaction does not justify a guard for an impossible
  internal state; it only changes how a programmer defect would be reported.
- Do not remove assertions that protect security boundaries, persisted data,
  concurrency invariants, or mutable states supported execution can enter.

## Related

GEN-SAFE-01, GEN-SAFE-02, GEN-DESN-03, FUNC-ARCH-03, TYP-TYPE-06
