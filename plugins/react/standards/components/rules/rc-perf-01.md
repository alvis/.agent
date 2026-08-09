# RC-PERF-01: No Inline Objects/Arrays in Render

## Intent

Object and array literals declared inside JSX (`style={{ margin: 10 }}`, `options={{ showEmail: true }}`) get a new identity every render, defeating `React.memo`, `useMemo`, and dependency arrays in children.

## Fix

- Hoist constant objects/arrays to module scope
- Memoize per-render-derived values with `useMemo`
- Memoize handlers with `useCallback` when passed to memoized children

```typescript
// ❌ BAD: creating objects in render
export const BadComponent = ({ user }) => {
  return (
    <UserProfile
      style={{ margin: 10 }} // new object every render
      options={{ showEmail: true }} // new object every render
    />
  );
};

// ✅ GOOD: hoist or memoize
const PROFILE_STYLE = { margin: 10 };
const PROFILE_OPTIONS = { showEmail: true };

export const GoodComponent = ({ user }) => (
  <UserProfile style={PROFILE_STYLE} options={PROFILE_OPTIONS} />
);
```

## Code Superpowers

- AST-scan JSX attributes for object-literal or array-literal expressions
- Cross-reference with whether the receiving component is wrapped in `memo`

## Common Mistakes

1. Inline `style={{...}}` on every render
2. Inline `[1, 2, 3]` arrays passed as props
3. New arrow functions inline as event handlers passed to memoized children

## Edge Cases

- Components that don't memoize and aren't on a hot path can tolerate inline objects
- Single-instance pages where re-render cost is negligible

## Related

RC-PERF-02, RC-STATE-01
