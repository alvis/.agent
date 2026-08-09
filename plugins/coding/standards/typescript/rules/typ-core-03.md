# TYP-CORE-03: No Type-Escape Casting in Production

## Intent

Type-escape casts are forbidden in production code, including `as unknown as TYPE` and `as never`. Fix the type model, add guard-based narrowing, or use `// @ts-expect-error <reason>` for intentional mismatches.

## Fix

```typescript
// type guard instead of casting
function isUser(value: unknown): value is User {
  return typeof value === "object" && value !== null && "id" in value && "name" in value;
}

if (!isUser(data)) throw new ValidationError("Invalid user data");
const user = data; // TypeScript knows this is User
```

### Why `as unknown as TYPE` Is Dangerous

1. **No validation**: Bypasses all type checking -- the data could be anything
2. **Runtime errors**: Creates false confidence in type safety
3. **Hidden bugs**: Type mismatches only discovered at runtime
4. **Defeats TypeScript**: Makes the type system useless

### Refactoring Alternatives

When tempted to use `as unknown as TYPE`:

1. **Analyze** why the types do not match
2. **Root cause** -- Identify the actual issue:
   - Incorrect type definitions?
   - Missing type guards?
   - Wrong function signature?
   - Data structure mismatch?
3. **Fix properly** using one of these solutions:
   - Create type guards with runtime validation
   - Refactor data structures to match types
   - Update type definitions to reflect reality
   - Add proper validation at boundaries
4. **When a mismatch is intentional** and a runtime guard adds no value, annotate with `@ts-expect-error <reason>` on the preceding line. Prefer over `@ts-ignore` — TS errors if the suppression becomes redundant.

```typescript
// ❌ BAD: double-cast silently discards type information
const config = rawValue as unknown as Config;

// ✅ GOOD: type guard — validates at runtime, narrows safely
function isConfig(v: unknown): v is Config {
  return typeof v === "object" && v !== null && "host" in v;
}
if (!isConfig(rawValue)) throw new Error("invalid");
const config = rawValue;

// ✅ GOOD: @ts-expect-error — intentional mismatch, self-documenting
// @ts-expect-error rawValue is Config-shaped but lacks optional `timeout` populated at init
const config = rawValue as Config;

// ✅ GOOD: refactor to fix type issues
interface ApiResponse {
  user: User;
  metadata: ResponseMetadata;
}
const response: ApiResponse = await fetchUser(); // proper typing
const user = response.user;
```

### Testing-Only Exception

Testing partial-cast chains are allowed only in test files. See `TYP-TYPE-07` for the acceptable patterns.

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `value as unknown as User`, refactor before adding new behavior.
- If types mismatch, fix schema/type contracts first; use testing exception path only in test files with explicit partial-type validation.
- Prefer `@ts-expect-error` over `@ts-ignore`; `@ts-ignore` never errors when the suppression is no longer needed.

## Related

TYP-CORE-01, TYP-CORE-02, TYP-TYPE-07
