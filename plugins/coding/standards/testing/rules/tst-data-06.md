# TST-DATA-06: Prefer `toEqual` for Value Equality; Reserve `toBe` for Primitives and Reference Identity

## Intent

`toEqual` performs structural deep equality; `toBe` is `Object.is`. Asserting an object or array literal with `toBe` couples the test to the *exact reference* the SUT happens to return, which is almost never the contract under test — the test becomes a referential-identity check disguised as a value check, and any harmless refactor that returns a new object (defensive copy, structural-sharing optimization, immer/produce, etc.) silently breaks it.

Default to `toEqual` for value equality. Reach for `toBe` only when:

- the asserted value is a **primitive** (`string`, `number`, `boolean`, `bigint`, `symbol`, `null`, `undefined`); or
- the test is **deliberately** asserting referential identity — e.g. a cache returns the same instance, or a barrel re-exports the same symbol (see `TST-CORE-10`).

## Fix

```typescript
// ❌ VIOLATION: structural compare against an object literal via `toBe`
expect(result).toBe({ id: 'u1' });

// ✅ COMPLIANT: deep equality via `toEqual`
expect(result).toEqual({ id: 'u1' });
```

```typescript
// ❌ VIOLATION: structural compare against an array literal via `toBe`
expect(items).toBe(['a', 'b']);

// ✅ COMPLIANT: deep equality via `toEqual`
expect(items).toEqual(['a', 'b']);
```

```typescript
// ✅ COMPLIANT: primitive — `toBe` is correct
expect(count).toBe(0);
expect(name).toBe('alice');
expect(ready).toBe(true);

// ✅ COMPLIANT: intentional referential identity — cache returns same instance
expect(getCached(key)).toBe(getCached(key));
```

## Assertion Preferences

<IMPORTANT>
Pick the matcher based on what is being asserted:

- **`toBe`** — primitives, or intentional referential identity (`Object.is`).
- **`toEqual`** — value equality for objects, arrays, nested structures.
- **`toStrictEqual`** — value equality where prototype, class identity, or sparse-array distinctions matter.
- **`toMatchObject` / `expect.objectContaining`** — partial structural matches when only some fields are part of the contract.
</IMPORTANT>

## Edge Cases

- **`toStrictEqual`** is permitted (and preferred over `toEqual`) when the test must distinguish a class instance from a plain object, or detect a missing/extra `undefined` field, or differentiate `[1, , 3]` from `[1, undefined, 3]`.
- **Primitive `toBe`** — `expect(x).toBe(0)`, `expect(x).toBe(true)`, `expect(x).toBe(null)`, `expect(x).toBe(undefined)` remain correct and are not flagged.
- **Barrel-identity assertions** — `expect(barrel.UserService).toBe(UserService)` is governed by `TST-CORE-10` (which forbids the whole assertion as low-value), not by this rule.
- **Intentional identity checks** — when the contract under test *is* "returns the same reference" (e.g. memoization, interning, singleton), `toBe` is the correct matcher; document the intent inline if it would otherwise read as a structural compare.

## Related

TST-DATA-02, TST-CORE-09, TST-CORE-10
