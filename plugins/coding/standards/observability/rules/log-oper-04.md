# LOG-OPER-04: Structured Logs with Context

## Intent

Always log structured fields required for traceability (ids, actor, operation, resource, latency, status). Never use free-form string-only logs with no machine-readable metadata.

## Fix

```typescript
action.log.info("processing refund", {
  requestId,
  orderId,
  userId,
  latencyMs,
});
```

### Structured error with context

```typescript
action.log.error("Payment failed", {
  userId,
  orderId,
  amount: order.total,
  error: error.message,
  gateway: "stripe",
});

// ❌ BAD: string concatenation, no structured fields
// action.log.error("Error: " + error.message);
```

## Always Log

- Auth failures
- Validation errors
- External service failures
- Unhandled exceptions
- Performance warnings
- Business rule violations
- Critical state changes

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `logger.info("done")` or ❌ `action.log.error("Error: " + error.message)`, refactor before adding new behavior.

## Related

LOG-OPER-01, LOG-OPER-02, LOG-OPER-03
