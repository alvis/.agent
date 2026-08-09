# LOG-OPER-01: Transactional Logger Only

## Intent

Use the project logger (`action.log`/equivalent). Do not use `console.*` in application/runtime logic. `console.*` is acceptable only in CLI tools, build scripts, and test helpers.

## Fix

```typescript
export async function processOrder(orderId: string, action: Action): Promise<void> {
  action.log.info("Processing order", { orderId });
}
```

### Log Levels Reference

| Level | Use | Environment |
|-------|-----|-------------|
| `debug` | Verbose diagnostics: function inputs/outputs, SQL queries, internal state | Development only |
| `info` | High-level events: service lifecycle, major milestones, user-initiated actions | All environments |
| `warn` | Recoverable issues: performance degradation, fallback behavior, retry attempts | All environments |
| `error` | Failed operations: caught exceptions, broken functionality, business rule violations | All environments (triggers alerts) |
| `fatal` | Unrecoverable shutdown: missing critical config, corrupted state | All environments (triggers critical alerts, then process exits) |

### Structured logging with context

```typescript
action.log.error("Payment failed", {
  userId,
  orderId,
  amount: order.total,
  error: error.message,
  gateway: "stripe",
});

// ❌ BAD: string concatenation
// action.log.error("Error: " + error.message);
```

### Performance logging with threshold

```typescript
const startTime = Date.now();
const result = await slowOperation();
const duration = Date.now() - startTime;

if (duration > PERFORMANCE_THRESHOLD) {
  action.log.warn("Slow operation detected", {
    operation: "data:processing",
    meta: {
      duration,
      threshold: PERFORMANCE_THRESHOLD,
      recordCount: result.length,
    },
  });
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `console.log("processing")` or ❌ `console.log("This is wrong")`, refactor before adding new behavior.
- `console.*` is acceptable only in CLI tools, build scripts, and test helpers -- never in application/runtime flow.

## Related

LOG-OPER-02, LOG-OPER-03, LOG-OPER-04
