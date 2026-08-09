# LOG-OPER-05: Consistent Domain Terms

## Intent

Use one canonical domain vocabulary per concept across all logs. Establish a domain glossary and enforce it across all log messages and operation keys.

## Fix

```typescript
// always "user" -- never switch between "customer", "client", "account"
action.log.info("user login successful", {
  operation: "auth:login",
  userId: user.id,
});

// always "order" -- never switch between "purchase", "transaction"
action.log.info("order payment completed", {
  operation: "billing:payment",
  orderId: order.id,
});
```

### Consistent operation naming scheme

```typescript
// domain:action pattern across all operations
action.log.info("processing refund", { operation: "billing:refund", orderId });
action.log.info("sending notification", { operation: "notification:send", userId });
```

### Terminology consistency

```
- Always use "user" (not sometimes "customer", "client", "account")
- Always use "order" (not sometimes "purchase", "transaction")
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `logger.info("client login failed")` (should use "user" not "client"), refactor before adding new behavior.
- Establish a domain glossary and enforce it across all log messages and operation keys.

## Related

LOG-OPER-01, LOG-OPER-02, LOG-OPER-03
