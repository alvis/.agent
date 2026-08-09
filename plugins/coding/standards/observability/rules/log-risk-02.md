# LOG-RISK-02: User Action and State-Change Auditability

## Intent

Log authorization changes, ownership changes, destructive operations, and other compliance-sensitive actions. Every security-relevant state change must produce an audit trail.

## Fix

```typescript
action.log.info("user role updated", {
  actorUserId,
  targetUserId,
  previousRole,
  nextRole,
});
```

### Structured audit for auth events

```typescript
action.log.info("User login successful", {
  operation: "auth:login",
  meta: {
    userId: user.id,
    loginMethod: "oauth",
    provider: "google",
  },
});

// ❌ BAD: no context, includes PII
// console.log(`User ${user.email} logged in`);
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `updateUserRole(data)` with no audit log, refactor before adding new behavior.
- Log all: authorization changes, ownership changes, destructive operations, compliance-sensitive actions, login/logout events.

## Related

LOG-RISK-01, LOG-RISK-03, LOG-OPER-01
