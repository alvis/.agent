# RH-ASYNC-01: Standard Async Hook Shape

## Intent

Async data hooks return `{ data, loading, error, refetch }`. Always include both `loading` and `error` so consumers can render every state without guesswork.

## Fix

- Initialize `{ data: null, loading: false, error: null }` and update atomically in one `setState` call
- Set `loading: true` before the request and reset on success/failure
- Capture errors into `error` rather than throwing past the hook boundary
- Expose a `refetch` callback for retries

```typescript
// pattern template
export function useApiData<T>(endpoint: string) {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({ data: null, loading: false, error: null });

  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await apiClient.get<T>(endpoint);
      setState({ data: response.data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
    }
  }, [endpoint]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...state,
    refetch: fetchData,
    isSuccess: state.data !== null && !state.loading,
  };
}
```

## Code Superpowers

- Grep async hook returns; flag any missing `loading` or `error` fields
- Verify state transitions: loading flag flipped before await, cleared after

## Common Mistakes

1. Returning only `{ data }` and letting consumers diff for `undefined` to detect loading
2. Throwing instead of capturing errors (crashes consumers)
3. Forgetting to clear `error` on a new request

## Edge Cases

- Polling hooks may add `lastUpdated` and `intervalMs` while preserving the base shape
- Mutation hooks may use `{ mutate, isPending, error }` to mirror common libraries

## Related

RH-RETURN-01, RH-CLEANUP-01
