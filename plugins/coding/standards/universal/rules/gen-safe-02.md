# GEN-SAFE-02: Fix Root Causes

## Intent

Diagnose underlying causes first. Resolve with correct types, validation, design changes, or dependency fixes. Do not patch symptoms while leaving the root defect unresolved.

## Fix

```typescript
// ❌ BAD: symptom patch that hides failures
try {
  processOrder(order);
} catch {
  return; // silent swallow
}

// ✅ GOOD: fix root cause or handle explicitly
const parsedConfig = configSchema.parse(rawConfig);
startServer(parsedConfig);
```

## Correct Approach

1. **Understand the root cause** -- use diagnostic tools to understand the underlying issue
2. **Refactor or fix** -- change code structure, types, or logic to resolve properly
3. **Fix properly** -- correct type definitions, add type guards, refactor code, fix logic errors
4. **Test the solution** -- verify the fix is correct and complete
5. **Document if needed** -- only add comments to explain legitimate design decisions

## Gather Context Before Acting

```typescript
// ✅ GOOD: read existing patterns before creating new ones
// 1. Search codebase for similar functionality
// 2. Understand current patterns and conventions
// 3. Only then propose solution aligned with existing system
```

- Read relevant code before modifying
- Check existing implementations for patterns
- Ask clarifying questions when requirements are ambiguous
- Gather input before making architectural decisions

## Temporary Mitigation With Tracking

```typescript
// If immediate mitigation is unavoidable:
// TODO(JIRA-456): Fix upstream type definition for ExternalApi.getUser
// Temporary: schema validation at boundary until upstream types are corrected
const rawUser = externalApi.getUser(id);
const user = userSchema.parse(rawUser);
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `catch { return }`, refactor before adding new behavior.
- If immediate mitigation is required, pair it with a scheduled root-cause fix and explicit temporary boundaries.

## Related

GEN-SAFE-01, GEN-SAFE-03, GEN-CONS-01
