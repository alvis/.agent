# LOG-OPER-02: Correct Log Level Selection

## Intent

Map outcomes to severity deliberately: `debug` for diagnostics, `info` for expected success milestones, `warn` for degraded-but-recovered states, `error` for failed operations, `fatal` for unrecoverable shutdown paths. Do not log failures as `info` or routine success paths as `error`.

## Fix

```typescript
action.log.warn("retrying payment request", { orderId, attempt });
action.log.error("payment processing failed", { orderId, error });
```

### Include outcome in completion messages

```typescript
// include outcome -- "successfully" / "failed" -- so the level is unambiguous
action.log.info("Order processed successfully", { orderId });
action.log.error("Authentication failed: invalid token", { userId });

// ❌ BAD: outcome unclear from message
// action.log.info("Order processed");
// action.log.info("Authentication complete");
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `logger.info("payment failed")`, refactor before adding new behavior.
- Choose the lowest severity that still communicates required operator action.

## Related

LOG-OPER-01, LOG-OPER-03, LOG-OPER-04
