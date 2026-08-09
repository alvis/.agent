# RH-STABLE-01: Stable Return Values

## Intent

Hooks that return objects or arrays must memoize them. A new object identity every render breaks `React.memo` for any consumer and triggers re-runs in dependent `useEffect`/`useMemo`.

## Fix

- Wrap composite return values in `useMemo`
- Wrap returned callbacks in `useCallback`
- Avoid object spread in the return statement when the inputs themselves are stable

```typescript
// ❌ BAD: new object every render
function useBadReturn(data: any[]) {
  return {
    data,
    metadata: { count: data.length }, // new object every render
  };
}

// ✅ GOOD: stable memoized object
function useGoodReturn(data: any[]) {
  const metadata = useMemo(() => ({ count: data.length }), [data.length]);
  return { data, metadata };
}

// ✅ GOOD: stable callback
const callback = useCallback((id: string) => {
  updateItem(id);
}, [updateItem]);
```

## Code Superpowers

- AST-scan hook returns; flag inline object/array literals constructed in the return
- Confirm callbacks returned from hooks are wrapped in `useCallback`

## Common Mistakes

1. Building a derived object inline in `return`
2. Returning a fresh array each render even when contents are unchanged
3. Forgetting that `{ ...state }` produces a new identity

## Edge Cases

- Tiny hooks consumed by non-memoized components may not need explicit memoization
- Returning a single primitive doesn't need memoization

## Related

RH-RETURN-01, RH-DEPS-01
