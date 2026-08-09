# GEN-SAFE-01: No Suppression Without Approval

## Intent

Do NOT use suppression comments to bypass errors unless the user explicitly approves the exception. Suppression comments are a last resort only; always attempt to fix the root cause first.

## Fix

```typescript
// ❌ BAD: suppressing instead of fixing
// @ts-ignore
const user = getData() as User;

// ✅ GOOD: fix the underlying issue with a type guard
if (!isUser(payload)) {
  throw new ValidationError("invalid user payload");
}
const user = payload;
```

## Linter Suppression Alternatives

```typescript
// ❌ BAD: suppressing the linter instead of following its suggestion
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
const value = a || b || false;
/* eslint-enable */

// ✅ GOOD: follow the linter's suggestion
const value = a ?? b ?? false;
```

## Type Guard Over Suppression

```typescript
// ❌ ABSOLUTELY BAD: silencing the problem
// @ts-ignore
const result: User = riskyFunction();

// ✅ GOOD: understanding and fixing the root cause
function isValidResult(value: unknown): value is Result {
  return typeof value === "object" && value !== null && "data" in value;
}

const rawResult = riskyFunction();
if (!isValidResult(rawResult)) {
  throw new Error("Invalid result from riskyFunction");
}
const result = rawResult;
```

## Why Suppression Is Harmful

- **Masks real issues** -- the problem continues to exist, just hidden
- **Creates technical debt** -- future maintainers won't understand the workaround
- **Breaks continuous improvement** -- can't identify and fix root causes
- **Violates DRY principle** -- working around a problem instead of fixing it

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `// @ts-ignore`, refactor before adding new behavior.
- If a suppression seems necessary, first attempt type/model refactor or guard-based fix; escalate only when blocked externally.
- Approved suppressions require a root-cause note and follow-up task.

## Related

TYP-CORE-04, GEN-SAFE-02, GEN-SAFE-03
