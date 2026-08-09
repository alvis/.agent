# RC-PERF-02: Strategic Memoization

## Intent

Use `memo`, `useMemo`, and `useCallback` for genuinely expensive operations and stable references — not as default decoration. Apply where profiling or obvious cost (large lists, heavy sorts, memoized children) justifies it.

## Fix

- Wrap expensive list components with `memo`
- Wrap expensive derivations with `useMemo` keyed on real inputs
- Wrap handlers with `useCallback` when passed to memoized children

```typescript
// ✅ GOOD: memoize expensive calculations
export const ExpensiveList = memo(({ items }: Props) => {
  const sortedItems = useMemo(() => 
    items.sort((a, b) => b.timestamp - a.timestamp), [items]
  );
  
  const handleClick = useCallback((id: string) => {
    updateItem(id);
  }, [updateItem]);
  
  return <div>{sortedItems.map(item => <Item key={item.id} ... />)}</div>;
});
```

## Code Superpowers

- Identify components rendering large lists (>50 items) without `memo`
- Identify expensive operations (`sort`, `filter` on large arrays) called inline without `useMemo`
- Identify handlers passed to `memo`-wrapped children without `useCallback`

## Common Mistakes

1. Wrapping every component in `memo` "just in case" (cost without benefit)
2. `useMemo` with empty deps (`[]`) on values that depend on props
3. `useCallback` whose deps include unstable inline objects (defeats the purpose)

## Edge Cases

- Tiny components rendering primitive props rarely benefit from `memo`
- Server components and one-shot pages don't need any of this

## Related

RC-PERF-01
