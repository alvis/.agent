# FUNC-SIGN-06: Avoid Conditional Spread for Optional Keys

## Intent

Pass optional values directly. Reserve conditional spread for the few consumers
that genuinely distinguish a missing key from `key: undefined`.

## Fix

```typescript
// ✅ direct — `filter` is `undefined` if absent; consumers tolerate this
const query = { url, filter: opts.filter };

// ❌ unnecessary branch — same observable behavior for almost all consumers
const query = {
  url,
  ...(opts.filter ? { filter: opts.filter } : {}),
};
```

### Why Direct Passing Is Safe (Common Consumers)

These consumers treat `key: undefined` and `key absent` the same — the guard
adds no behavior:

| Consumer                                           | Behavior with `key: undefined`                                                                     |
|----------------------------------------------------|----------------------------------------------------------------------------------------------------|
| **Prisma Client** (`where`, `data`, `update`)      | `undefined` values are **not included** in the generated query (Prisma docs, "Null and undefined") |
| **`JSON.stringify(obj)`**                          | `undefined` properties are **omitted** from output (MDN, JSON.stringify Description)               |
| **React props** (`<C {...props} />`)               | `undefined` props are treated as not-passed; defaults / `defaultProps` apply                       |
| **Destructuring with defaults** (`{ a = 1 } = x`)  | `undefined` triggers the default, same as missing                                                  |
| **Most HTTP/RPC client option bags**               | Serialize through `JSON.stringify`, so behave identically                                          |

In all of the above, write the value directly. Do not guard.

## Edge Cases — When the Branch IS Justified

Keep the conditional spread only when one of these consumer-specific contracts
applies. Cite the contract in a one-line comment so the next reader doesn't
strip the guard.

1. **`'key' in obj` / `Object.keys` / `Object.hasOwn` checks downstream.** These
   distinguish presence from `undefined`. If the consumer uses any of them,
   omit the key:
   ```typescript
   // downstream uses `'filter' in opts` to decide whether to apply a default
   ...(opts.filter !== undefined ? { filter: opts.filter } : {}),
   ```

2. **TypeScript `exactOptionalPropertyTypes: true`.** With this flag, the type
   system rejects `{ filter: undefined }` for `filter?: T` (TS docs,
   `exactOptionalPropertyTypes`). Either omit the key, or widen the type to
   `filter?: T | undefined`.

3. **Spreading over defaults.** `{ ...defaults, ...overrides }` where
   `overrides.key === undefined` will **overwrite** the default with
   `undefined`. Guard the override:
   ```typescript
   const merged = {
     timeout: 5000,
     ...(opts.timeout !== undefined ? { timeout: opts.timeout } : {}),
   };
   ```

4. **`URLSearchParams` / `FormData` / query-string builders.** A record
   constructor coerces values to strings, so `undefined` becomes the literal
   string `"undefined"` (MDN, URLSearchParams constructor). Filter before
   constructing.

5. **Prisma with `strictUndefinedChecks` preview enabled.** This flag makes
   Prisma **throw** on explicit `undefined` instead of silently dropping it.
   Projects opting in must guard.

6. **Drivers / wire formats that serialize `null` vs absent differently**
   (e.g. some MongoDB query operators, JSON-Patch, certain gRPC messages).
   Cite the specific contract in the comment.

If the consumer is not in this list, prefer the direct form.

## Refactoring Note

When removing an existing guard, run the relevant test (or rely on
`exactOptionalPropertyTypes` if enabled) to confirm no consumer relies on
key absence. Don't remove guards in front of `URLSearchParams`, spread-over-
defaults, or `'in'` checks without changing the consumer too.

## Related

FUNC-SIGN-02, FUNC-SIGN-04, FUNC-STAT-02
