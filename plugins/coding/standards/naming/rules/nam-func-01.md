# NAM-FUNC-01: Verb-First Function Names

## Intent

Functions MUST start with verbs and clearly encode action. Noun-only function names like `user()` or `validation()` are non-compliant.

## Fix

```typescript
// verb-first function names
function validateEmail(email: string): boolean { /* ... */ }
function createLogger(config: LogConfig): Logger { /* ... */ }
function sendNotification(userId: string, message: string): Promise<void> { /* ... */ }
```

## Verb Categories

| Verb | Usage | Return Type | Example |
|------|-------|-------------|---------|
| `get*` | Sync/cached retrieval | Any | `getUserName`, `getConfig` |
| `fetch*` | Async, external source | `Promise<T>` | `fetchUserProfile`, `fetchOrders` |
| `find*` | Search operation | `T \| null` | `findUserByEmail`, `findProduct` |
| `list*` | Return collection | `T[]` | `listActiveUsers`, `listProducts` |
| `create*` | Create a new entity or in-memory instance | `T` or `Promise<T>` | `createUser`, `createOrder` |
| `update*` | Modify existing | `T` or `Promise<T>` | `updateUser`, `updateProfile` |
| `set*` | Assign or persist a value | `void` or `Promise<void>` | `setUserStatus`, `setWorkspaceName` |
| `delete*` | Destructive removal | `void` or `Promise<void>` | `deleteUser`, `deleteWorkspace` |
| `validate*` | Detailed validation | `ValidationResult` | `validateInput`, `validateEmail` |
| `is*` | State check | `boolean` | `isValid`, `isActive` |
| `has*` | Possession check | `boolean` | `hasPermission`, `hasChanges` |
| `can*` | Capability check | `boolean` | `canEdit`, `canDelete` |
| `should*` | Recommendation | `boolean` | `shouldRefresh`, `shouldRetry` |
| `transform*` | General change | `T` | `transformData`, `transformResponse` |
| `parse*` | String to structured | `T` | `parseConfig`, `parseJson` |
| `format*` | Structured to string | `string` | `formatCurrency`, `formatDate` |
| `serialize*` | Object to string | `string` | `serializeUser`, `serializePayload` |
| `build*` | Construct complex | `T` | `buildQueryString`, `buildRequest` |

### Choosing Function Verbs

- **Retrieving data?** -> `get*` (sync) or `fetch*` (async)
- **Searching?** -> `find*` or `list*`
- **Creating?** -> `create*` for a new entity or instance, or `build*` for a derived structure
- **Modifying?** -> `update*` for an existing entity or `set*` for assignment
- **Removing?** -> `delete*` or another domain verb that states the irreversible effect
- **Checking state?** -> `is*`, `has*`, `can*`, `should*`
- **Transforming?** -> `transform*`, `parse*`, `format*`, `serialize*`
- **Validating?** -> `validate*`

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `function user() {}`, refactor before adding new behavior.
- Boolean-returning functions may use `is*`, `has*`, `can*`, `should*` prefixes (see `NAM-DATA-03`).

## Related

NAM-FUNC-02, NAM-FUNC-03
