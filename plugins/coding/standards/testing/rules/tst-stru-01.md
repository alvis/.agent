# TST-STRU-01: Enforce File Naming and Isolation

## Intent

Use `*.spec.ts` for unit, `*.int.spec.ts` for integration, `*.e2e.spec.ts` for end-to-end. Unit tests must stay isolated; integration tests must not rely on unit-style mocks.

## Fix

```typescript
// Before: Wrong naming convention
user.test.ts

// After: Correct naming conventions
user-service.spec.ts        // unit test
user-service.int.spec.ts    // integration test
user-service.e2e.spec.ts    // end-to-end test
```

## File Naming

- Unit tests: `*.spec.ts` or `*.spec.tsx`
- Integration tests: `*.int.spec.ts`
- End-to-end tests: `*.e2e.spec.ts`

**Test Isolation**: Unit tests (`.spec.ts`) must be fully isolated. Use mocks for databases, APIs, and services. Integration tests (`.int.spec.ts`) may use real internal dependencies and external services. **Mocking is NOT allowed in integration tests** - they must exercise real code paths.

## Edge Cases

- When existing code matches prior violation patterns such as `user.test.ts`, refactor before adding new behavior.

## Related

TST-STRU-02, TST-STRU-03, TST-CORE-01
