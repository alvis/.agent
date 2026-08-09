# TST-COVR-03: Coverage-Driven One-Test Workflow

## Intent

Write one test, rerun coverage, verify coverage gain, then continue.

## Fix

**Before:**
```typescript
it.each(cases)(...) // multiple tests written at once
```

**After:**
```typescript
vitest --coverage spec/user.spec.ts
```

## Coverage-Driven Workflow

1. **Run coverage FIRST** to identify uncovered lines
2. **Write ONE test** targeting an uncovered line/branch
3. **Run coverage again** to verify improvement
4. **Keep or delete**: Coverage increased → keep; Same → delete immediately
5. **Repeat** for next uncovered line

```bash
vitest --coverage spec/path/to/file.spec.ts
```

## Edge Cases

- When existing code matches prior violation patterns such as `it.each(cases)(...)`, refactor before adding new behavior.
- If coverage gain is zero and behavioral value is not unique, delete or merge the test.

## Related

TST-COVR-01, TST-COVR-02, TST-COVR-04
