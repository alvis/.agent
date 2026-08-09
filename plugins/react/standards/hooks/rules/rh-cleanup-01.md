# RH-CLEANUP-01: Effect Cleanup

## Intent

Async operations started in `useEffect` must be cancelable so they don't update state on unmounted components or leak resources. Use a cancellation flag, `AbortController`, or `clearTimeout`/`clearInterval` in the cleanup function.

## Fix

- Add a `let cancelled = false` flag and check it before calling state setters
- For fetch, pass an `AbortController` signal and `.abort()` on cleanup
- For timers, return `() => clearTimeout(handler)` from the effect

```typescript
// ✅ GOOD: cleanup pattern
useEffect(() => {
  let cancelled = false;
  fetchData().then(data => {
    if (!cancelled) setState(data);
  });
  return () => { cancelled = true; };
}, []);

// ✅ GOOD: debounce value with cleanup
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
```

## Code Superpowers

- Grep `useEffect` bodies that contain `await` / `.then(` and verify the effect returns a cleanup function
- Flag `setTimeout`/`setInterval` inside effects without matching `clearTimeout`/`clearInterval`

## Common Mistakes

1. Calling `setState` on unmounted components ("Can't perform a React state update" warnings)
2. Forgetting cleanup, causing duplicated subscriptions on dependency changes
3. Cleaning up the timer ID variable from the wrong closure

## Edge Cases

- Effects whose async work resolves synchronously can skip the flag
- Long-lived subscriptions may need `useEffect` + a manual `unsubscribe` returned from the lib

## Related

RH-DEPS-01, RH-ASYNC-01
