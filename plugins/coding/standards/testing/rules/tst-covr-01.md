# TST-COVR-01: 100% Coverage Required

## Intent

Statements, branches, functions, and lines must each reach 100% for target
code, excluding approved ignore-file exceptions (barrel/type-only files).

## Fix

**Before:**
```typescript
global: { lines: 98, statements: 98 }
```

**After:**
```typescript
global: { lines: 100, statements: 100 }
```

## Requirements

<IMPORTANT>
- **100% statements, branches, functions, and lines** (excluding barrel and type files)
- Write tests ONE AT A TIME with coverage verification after each
- If a test adds zero coverage improvement, keep it only when it provides
  distinct behavioral evidence; otherwise delete it immediately
- Remove dead code BEFORE measuring coverage — the 100% threshold applies to
  living code only. Never keep an unused symbol, no-value wrapper, or
  change-detector test to satisfy the threshold; delete the dead subject
  (`GEN-DESN-04`, `FUNC-ARCH-03`) and the threshold applies to what remains.
</IMPORTANT>

Exclude barrel files (`index.ts`) and pure type files (`types.ts`) by placing `/* v8 ignore file */` at the top of the file.

For the one-test-at-a-time workflow, see `TST-COVR-03`.

## Configuration

```typescript
// vitest.config.ts
{
  coverage: {
    provider: 'v8',
    thresholds: {
      global: { branches: 100, functions: 100, lines: 100, statements: 100 }
    }
  }
}
```

## Edge Cases

- When existing code matches prior violation patterns such as `lines: 98`, refactor before adding new behavior.
- If uncovered lines remain, prioritize tests for failure/fallback branches before adding variation tests.
- Barrel files are ignore-marked with `/* v8 ignore file */`; do not write
  re-export tests to chase their coverage.

## Related

TST-COVR-02, TST-COVR-03, TST-COVR-04
