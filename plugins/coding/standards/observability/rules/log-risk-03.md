# LOG-RISK-03: Performance Visibility

## Intent

Record duration and threshold signals for expensive operations. Use threshold-based warnings to surface slow operations without noisy always-on logging.

## Fix

```typescript
action.log.info("invoice generation completed", {
  accountId,
  durationMs,
  itemCount,
});
```

### Threshold-based performance warning

```typescript
const startTime = performance.now();

try {
  const result = await processData();
  const duration = performance.now() - startTime;

  if (duration > 5000) {
    action.log.warn("Slow processing detected", {
      duration,
      threshold: 5000,
    });
  }

  return result;
} catch (error) {
  action.log.error("Processing failed", {
    error: error.message,
    duration: performance.now() - startTime,
  });
  throw error;
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `generateInvoice(data)` with no duration metric/log, refactor before adding new behavior.
- Use `performance.now()` for timing, not `Date.now()`, for sub-millisecond precision.

## Related

LOG-RISK-01, LOG-RISK-02, LOG-OPER-01
