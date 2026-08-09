# TST-COVR-02: Critical Branches Must Be Fully Covered

## Intent

Critical failure, fallback, and validation branches require full coverage.

## Fix

**Before:**
```typescript
if (err) throw err // untested
```

**After:**
```typescript
it("should throw when config missing", fn);
```

## What Counts as Critical

- Error-handling branches (`catch`, `if (error)`, fallback returns)
- Validation failures (guard clauses, input checks)
- Feature flags / configuration branches that affect behavior
- Timeout and retry paths

Prioritize tests for failure/fallback branches before adding variation tests for happy paths.

For immediate rejection criteria (redundant tests, artificial variations), see `TST-CORE-04`.

## Edge Cases

- When existing code matches prior violation patterns such as `if (err) throw err // untested`, refactor before adding new behavior.

## Related

TST-COVR-01, TST-COVR-03, TST-COVR-04, TST-CORE-04
