# TYP-CORE-04: Suppression Requires Approval

## Intent

`@ts-ignore`, `@ts-expect-error`, and lint suppression comments require explicit user approval and a root-cause note.

## Fix

```typescript
// approved suppression with root-cause note
// @ts-expect-error -- upstream @types/express missing overload, tracked in JIRA-1234
app.get("/health", handler);
```

### Violations

```typescript
// ❌ silencing errors without approval
// @ts-ignore
// @ts-expect-error
// eslint-disable-next-line
```

Suppression is a last resort after type guard, contract fix, and refactoring have all been ruled out.

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `// @ts-ignore`, refactor before adding new behavior.

## Related

GEN-SAFE-01, TYP-CORE-01, TYP-CORE-02, TYP-CORE-03
