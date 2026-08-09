# NAM-CORE-01: Descriptive, Domain-Aligned Names

## Intent

Names must communicate domain intent at point-of-use. Prefer explicit subject + role/action over placeholders. Avoid vague names like `data`, `temp`, `value`, or `err` at module/service boundaries.

## Fix

```typescript
// domain-aligned names at service boundaries
const activePatients = await patientRepository.listActive();
const emailValidationError = validateEmail(input.email);
```

## Naming Patterns

### Event Handlers and Callbacks

Event handlers use `handle*`; callbacks use `on*`:

```typescript
function handlePaymentFailure(error: PaymentError): void {
  notifyBillingTeam(error);
}
const onOrderStatusChange = (status: OrderStatus) => refreshDashboard(status);
```

### Class and Type Suffixes

| Pattern | Usage | Examples |
|---------|-------|----------|
| Managers | `*Manager` suffix | `ConnectionManager`, `CacheManager` |
| Handlers | `*Handler` suffix | `ErrorHandler`, `RequestHandler` |
| Processors | `*Processor` suffix | `PaymentProcessor`, `DataProcessor` |
| Errors | `*Error` suffix | `ValidationError`, `NotFoundError`, `AuthError` |
| Configs | `*Config` suffix | `DatabaseConfig`, `ServerConfig`, `AuthConfig` |
| Test doubles | `Mock*`, `Stub*`, `Test*` prefix | `MockUser`, `StubRepository`, `TestFixture` |

### Disallowed Placeholders

| Disallowed | Use Instead |
|------------|-------------|
| `data` | `userData`, `responseData`, `formData`, `userProfileData` |
| `temp` | `temporaryCache`, `temporaryResult`, `bufferData` |
| `err` | `error`, `validationError`, `authError` |
| `timeout` | `timeoutMs`, `requestTimeout`, `connectionTimeout` |
| `u`, `usr` | `user` |

### Common Anti-Patterns

| Anti-Pattern | Problem | Solution | Example |
|--------------|---------|----------|---------|
| Missing verbs | No action word | Add appropriate verb | `user()` -> `getUser()` |
| Generic names | Too vague | Be specific | `process()` -> `processPayment()` |
| Abbreviations | Hard to read | Use full words | `gUsr()` -> `getUser()` |
| Single letters | Unclear purpose | Descriptive names | `const d = new Date()` -> `const createdAt = new Date()` |
| Numbered variables | Poor organization | Use arrays/objects | `user1`, `user2` -> `users[0]`, `users[1]` |
| Misleading names | Name doesn't match behavior | Align name with action | `getUser()` (creates) -> `createUser()` |

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `const data = value`, refactor before adding new behavior.
- Short names like `i`, `j` are acceptable in tiny index loops where extra semantics add no value (see `NAM-DATA-04`).

## Related

NAM-CORE-02, NAM-CORE-03, NAM-CORE-04
