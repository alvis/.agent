# DOC-LIFE-04: Documentation Maintenance

## Intent

When behavior changes, update or remove related comments/JSDoc in the same PR. Stale documentation and dead comments are violations even if code still compiles.

## Fix

```typescript
// calculate 18% tax (updated Jan 2024)
const tax = amount * 0.18;
```

```typescript
// legacy processing removed in v2.0 - see PR #123
processModern(data);
```

## Remove Dead Comments

```typescript
// ❌ BAD: commented-out code
// const oldLogic = true;
// if (oldLogic) {
//   processLegacy();
// }

// ✅ GOOD: clean code without dead comments
// legacy processing removed in v2.0 - see PR #123
```

## Deprecation Documentation

```typescript
/**
 * user preferences for application behavior
 * @deprecated use appearance.theme instead (since 2.0.0)
 */
interface UserPreferences {
  /** @deprecated use appearance.theme instead */
  theme?: "light" | "dark";

  /** appearance settings including theme and layout */
  appearance: {
    theme: "light" | "dark" | "auto";
    compactMode: boolean;
  };

  /** preferred language code (ISO 639-1) */
  language: string;
}
```

## Stale Comment Detection

```typescript
// ❌ BAD: outdated comment
// calculate 15% tax (old rate)
const tax = amount * 0.18; // actual rate

// ✅ GOOD: updated comment
// calculate 18% tax (updated Jan 2024)
const tax = amount * 0.18;
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `// returns age` on a function that returns a string, fix the comment or remove it.
- Stale `@returns` or `@param` descriptions that no longer match the signature are violations.
- During refactors, actively search for comments referencing changed behavior in the same PR scope.

## Related

DOC-LIFE-01, DOC-LIFE-02, DOC-LIFE-03
