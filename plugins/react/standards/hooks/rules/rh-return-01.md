# RH-RETURN-01: Consistent Return Interface

## Intent

Hooks with similar purposes return similar shapes. Async data hooks return `{ data, loading, error, refetch }`. Tuple returns are reserved for ordered pairs (like `useState`). Returning unlabeled tuples for 3+ values forces consumers to memorize positions.

## Fix

- Return an object with named fields when there are 3+ values
- Use a tuple only for paired (value, setter) shapes mirroring `useState`
- Define a typed return interface (`UseDataReturn<T>`) for documentation and reuse

```typescript
// ✅ GOOD: consistent async pattern
interface UseDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useData<T>(url: string): UseDataReturn<T> {
  // implementation...
  return { data, loading, error, refetch };
}

// ❌ BAD: inconsistent return structure
function useBadData(url: string) {
  return [data, isLoading, err, reload]; // unpredictable array
}
```

## Code Superpowers

- AST-scan hook return statements; flag tuple literals with >2 elements
- Cross-check sibling hooks in the same module — return shapes should be uniform for the same purpose

## Common Mistakes

1. Tuples with 3+ elements that consumers must destructure positionally
2. Mixing object and tuple shapes across similar hooks
3. Adding fields silently to a hook return without updating the explicit interface

## Edge Cases

- `useState`-style hooks intentionally use `[value, setter]`
- Single-value hooks (`useDebounce`) return the value directly

## Related

RH-NAMING-01, RH-STABLE-01
