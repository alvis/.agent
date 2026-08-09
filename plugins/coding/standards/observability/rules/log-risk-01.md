# LOG-RISK-01: Never Log Sensitive Data

## Intent

Never log secrets or direct PII: passwords, tokens, API keys, auth headers, credit-card data, sensitive full payloads, or raw email in message strings. Log stable identifiers (`userId`, `orderId`) and sanitized metadata instead.

## Fix

```typescript
action.log.info("created api token", {
  userId,
  tokenId,
  tokenPreview: `${token.slice(0, 4)}***`,
});
```

### Stable identifiers only

```typescript
// log userId, never email or PII
action.log.info("User login successful", {
  operation: "auth:login",
  userId: user.id,
  loginMethod: "oauth",
  provider: "google",
});

// ❌ BAD: includes PII
// console.log(`User ${user.email} logged in`);
```

## Never Log

- Passwords or tokens
- PII (Personal Identifiable Info)
- Credit card numbers
- API keys or secrets
- Full request bodies with sensitive data
- User email addresses in messages (use `userId` instead)

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `logger.info("token", { token })` or ❌ `logger.warn("auth failed", { password })`, refactor before adding new behavior.
- If an attribute might be sensitive, redact/omit by default and only allowlist fields proven safe.

## Related

LOG-RISK-02, LOG-RISK-03, LOG-OPER-01
