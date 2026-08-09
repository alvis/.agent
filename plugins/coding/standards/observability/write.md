# Observability: Compliant Code Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.
> **Compliance**: Also follow `scan.md` in this directory to avoid violations during writing. When unsure about a specific rule, consult its detailed guidance in `rules/<rule-id>.md`.

## Key Principles

- Model failures with domain-specific error classes, not generic `Error`
- Throw early at detection, handle explicitly at boundaries (HTTP handlers, jobs, CLI)
- Use the project logger (`action.log`/equivalent), never `console.*` in app logic
- Map log levels to outcome severity deliberately
- Always include structured context fields for traceability (ids, actor, operation, resource, latency)
- Never log secrets, tokens, PII, or raw credentials
- Record duration and threshold signals for expensive operations

## Core Rules Summary

### Error Handling (ERR-HAND)

- **ERR-HAND-01**: Use domain-specific error classes instead of generic `Error` whenever context matters.
- **ERR-HAND-02**: Throw as soon as invalid state is detected; handle errors explicitly at system boundaries. Never swallow with empty catch.
- **ERR-HAND-03**: Error logs must retain cause chain and stack context when available.
- **ERR-HAND-04**: Cast caught errors immediately via `as Error` or a `toError` helper. Never use conditional branching on base `Error` in catch blocks.

### Logging Operations (LOG-OPER)

- **LOG-OPER-01**: Use the project logger (`action.log`/equivalent). No `console.*` in application/runtime logic.
- **LOG-OPER-02**: Map outcomes to severity: `debug` diagnostics, `info` success milestones, `warn` degraded-but-recovered, `error` failed operations, `fatal` unrecoverable shutdown.
- **LOG-OPER-03**: Messages must state action + target + outcome clearly with structured metadata.
- **LOG-OPER-04**: Always log structured fields required for traceability (ids, actor, operation, resource, latency, status).
- **LOG-OPER-05**: Use one canonical domain vocabulary per concept across all logs.

### Logging Risk Controls (LOG-RISK)

- **LOG-RISK-01**: Never log secrets or direct PII. Log stable identifiers and sanitized metadata instead.
- **LOG-RISK-02**: Log authorization changes, ownership changes, destructive operations, and compliance-sensitive actions.
- **LOG-RISK-03**: Record duration and threshold signals for expensive operations.

## Patterns

### Error Modeling

Use domain-specific error classes with cause chaining:

```typescript
try {
  await chargeOrder(order);
} catch (error) {
  const exception = error as Error;
  action.log.error("Charging order failed", {
    operation: "billing:charge-order",
    orderId: order.id,
    errorMessage: exception.message,
    stack: exception.stack,
  });
  throw new BillingChargeError("charging order failed", { cause: exception });
}
```

### Log Level Selection

| Level   | Use When                                      |
|---------|-----------------------------------------------|
| `debug` | Verbose diagnostic detail (dev only)          |
| `info`  | Expected success milestones                   |
| `warn`  | Degraded but recovered states                 |
| `error` | Failed operations requiring investigation     |
| `fatal` | Unrecoverable shutdown paths                  |

### Structured Context

Always include traceability fields in log metadata:

```typescript
action.log.info("Processing invoice completed", {
  operation: "billing:process-invoice",
  invoiceId,
  durationMs,
});
```

### Sensitive Data Handling

Log stable identifiers, never raw secrets:

```typescript
action.log.info("created api token", {
  userId,
  tokenId,
  tokenPreview: `${token.slice(0, 4)}***`,
});
```

## Anti-Patterns

- Logging whole request/response payloads by default.
- Free-form string-only logs with no machine-readable metadata.
- Downgrading failure logs to `info` for noise control.
- Swallowing errors with empty `catch` blocks or silent returns.

## Quick Decision Tree

1. Pick specific error class and fail early (`ERR-HAND-01`, `ERR-HAND-02`).
2. Use transactional logger with structured fields (`LOG-OPER-01`, `LOG-OPER-04`).
3. Validate message quality and terminology (`LOG-OPER-03`, `LOG-OPER-05`).
4. Confirm no sensitive data exposure (`LOG-RISK-01`).
5. Record duration for expensive operations (`LOG-RISK-03`).
