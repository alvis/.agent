# LOG-OPER-03: Message Formatting Contract

## Intent

Messages must state action + target + outcome clearly, with concise structured context in metadata. Start messages with an action verb. Avoid vague one-word messages (`payment`) and redundant prefixes (`Error: ...`) that add no operational signal.

## Fix

```typescript
action.log.info("validating user input", { requestId });
action.log.info("order processed successfully", { orderId });
```

### Message style

```typescript
// ✅ GOOD: starts with action verb, includes outcome
"Processing payment", "Validating user input", "Connecting to database"

// ❌ BAD: noun only, no action or outcome
"Payment", "User", "Database"

// ✅ GOOD: concise, specific
"Failed to parse JSON response from payment gateway"

// ❌ BAD: vague or overly verbose
"Error"
```

### User-facing vs developer messages

```typescript
// user-facing - clear and actionable
throw new ValidationError("Email address must be valid");

// developer details in structured logs only
action.log.debug("Email validation failed", {
  email,
  pattern: EMAIL_REGEX.toString(),
});
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `logger.info("payment")` or ❌ `logger.error("Error: " + error.message)`, refactor before adding new behavior.
- If context is structured metadata, keep message short and put details in fields; avoid stuffing all details into the message.

## Related

LOG-OPER-01, LOG-OPER-02, LOG-OPER-04
