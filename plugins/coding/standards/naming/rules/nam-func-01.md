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
| `create*` | New in-memory instance | `T` or `Promise<T>` | `createUser`, `createOrder` |
| `update*` | Modify existing | `T` or `Promise<T>` | `updateUser`, `updateProfile` |
| `set*` | Persist create/update | `void` or `Promise<void>` | `setUser`, `setWorkspace` |
| `drop*` | Destructive removal | `void` or `Promise<void>` | `dropUser`, `dropWorkspace` |
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
- **Creating?** -> `create*` (in-memory/factory) or `build*` (structure); use `Set<Entity>` for persisted records
- **Modifying?** -> `update*` for transient data; `Set<Entity>` for persisted state
- **Removing?** -> Use `Drop<Entity>` for destructive persistence
- **Checking state?** -> `is*`, `has*`, `can*`, `should*`
- **Transforming?** -> `transform*`, `parse*`, `format*`, `serialize*`
- **Validating?** -> `validate*`

<IMPORTANT>
**Persistence operations**: When working with persisted entities (database rows, durable resources), align with the data operation naming convention: use `Search<Entity>` / `List<Entity>` for multi-item reads, `Get<Entity>` for single-item reads, `Set<Entity>` for create/update upserts, and `Drop<Entity>` for destructive removes. Reserve `create*` for in-memory helpers or factories. See `NAM-FUNC-04`.
</IMPORTANT>

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `function user() {}`, refactor before adding new behavior.
- Boolean-returning functions may use `is*`, `has*`, `can*`, `should*` prefixes (see `NAM-DATA-03`).

## Related

NAM-FUNC-02, NAM-FUNC-03, NAM-FUNC-04
