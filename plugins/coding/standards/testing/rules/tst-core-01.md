# TST-CORE-01: Tests Must Obey TypeScript Standards

## Intent

Test code inherits full TypeScript constraints: no `any`, proper import separation, safe narrowing, and typed contracts.

## Fix

```typescript
const repo = { get: vi.fn() } satisfies Partial<UserRepo>;
```

## TypeScript Compliance

<IMPORTANT>
Testing code inherits all project TypeScript requirements:

- **No `any` types** - Use specific types for complete type safety
- **Strict type checking** - All mocks, fixtures, and test utilities must be properly typed
- **Type-safe assertions** - Ensure all expectations are type-safe
- **Proper imports** - Separate code and type imports (see `TYP-IMPT-*` rules)
</IMPORTANT>

```typescript
// ❌ VIOLATION: using any types bypasses typescript safety
const mockRepo: any = {
  save: vi.fn(),
  findById: vi.fn(),
};
```

For mock typing patterns (`satisfies`, class type disambiguation, triple pattern), see `TST-MOCK-05`.
For import organization rules, see `TYP-IMPT-01` through `TYP-IMPT-06`.

## Minimal Testing Principle

<IMPORTANT>
**Every test must add unique value. Redundant tests are maintenance debt.**

- **100% coverage with ABSOLUTE MINIMUM tests** - One test per unique behavior path
- Exclude barrel files (`index.ts`) and pure type files (`types.ts`) by placing `/* v8 ignore file */` at the top of the file
- Every test must verify: different code path, different behavior, OR real edge case
</IMPORTANT>

For detailed guidance on test uniqueness, see `TST-CORE-04` and `TST-CORE-05`.
For coverage thresholds and workflow, see `TST-COVR-01` through `TST-COVR-04`.

## Performance Guidelines

- **Fast execution** - Unit tests should run in milliseconds
- **Isolated tests** - No dependencies between tests
- **Minimal setup** - Avoid complex test fixtures
- **Parallel execution** - Tests should be parallelizable

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `const svc: any = {}`, refactor before adding new behavior.

## Related

TST-CORE-02, TST-CORE-03, TST-CORE-04, TST-MOCK-05
