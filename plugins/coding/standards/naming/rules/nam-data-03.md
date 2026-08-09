# NAM-DATA-03: Boolean Prefix Rules

## Intent

Booleans MUST use one of: `is*`, `has*`, `can*`, `should*`. Bare adjectives like `active` or Hungarian notation like `bIsActive` are non-compliant.

## Fix

```typescript
// state checks use is* prefix
const isActive = user.status === "active";
const isLoading = requestState === "pending";
const isAuthenticated = session !== null;
```

### has*, can*, should* Prefixes

```typescript
// possession uses has*, capability uses can*, recommendations use should*
const hasPermissions = user.roles.length > 0;
const canEdit = hasPermissions && isOwner;
const shouldRetry = attemptCount < MAX_RETRY_ATTEMPTS;
```

### Prefix Selection

| Prefix | Usage | Examples |
|--------|-------|----------|
| `is*` | State check | `isActive`, `isVisible`, `isLoading`, `isAuthenticated` |
| `has*` | Possession | `hasPermissions`, `hasChanges`, `hasError` |
| `can*` | Capability | `canEdit`, `canDelete`, `canSubmit` |
| `should*` | Recommendation | `shouldRefresh`, `shouldRetry` |

### Disallowed Bare Names

| Disallowed | Use Instead |
|------------|-------------|
| `active` | `isActive` |
| `enabled` | `isEnabled` |
| `visible` | `isVisible` |
| `loading` | `isLoading` |
| `authenticated` | `isAuthenticated` |

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `const active = true` or ❌ `bIsActive`, refactor before adding new behavior.
- Hungarian notation prefixes like `bIsActive` are non-compliant; use `isActive` directly.

## Related

NAM-DATA-01, NAM-DATA-02, NAM-DATA-04
