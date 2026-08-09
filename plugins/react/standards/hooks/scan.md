# React Hooks: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies and rule groups.

Any single violation blocks approval by default.
If a violation is detected, load the matching rule guide at `./rules/<rule-id>.md` to confirm the violation and follow its fix guidance.

## Quick Scan

### Naming

- DO NOT define a hook without the `use` prefix (`getUserData` for stateful logic) — React's lint rules require `use*` [`RH-NAMING-01`]
- DO NOT name hooks with generic words (`useData`, `useStuff`) — use specific intent (`useUserData`, `useApiRequest`) [`RH-NAMING-01`]
- DO NOT name hook files with PascalCase — use `camelCase.ts` starting with lowercase `use` (e.g., `useScroll.ts`, not `UseScroll.ts`) [`RH-NAMING-01`]

### Return Interface

- DO NOT return an unlabeled tuple for hooks with >2 values — return an object with named fields [`RH-RETURN-01`]
- DO NOT return a different shape from similar hooks — keep async hooks consistent: `{ data, loading, error, refetch }` [`RH-RETURN-01`]

### Dependencies

- DO NOT pass an empty `[]` to `useEffect`/`useCallback`/`useMemo` when it reads outer values — every external read must appear in deps [`RH-DEPS-01`]

### Async / Cleanup

- DO NOT skip loading or error state in async hooks — always include both [`RH-ASYNC-01`]
- DO NOT start async work in `useEffect` without a cancellation flag or `AbortController` — prevents leaks on unmount [`RH-CLEANUP-01`]

### Stable References

- DO NOT return inline-constructed objects from a hook (`return { data, metadata: { ... } }`) — memoize for stable identity [`RH-STABLE-01`]

### Composition & Reducer

- DO NOT duplicate auth/storage logic across hooks — compose from primitives like `useLocalStorage` and `useApiData` [`RH-COMPOSE-01`]
- DO NOT manage 4+ related fields with parallel `useState`s — use `useReducer` for coordinated updates [`RH-REDUCER-01`]

## Rule Matrix

| Rule ID | Violation | Bad Examples |
|---|---|---|
| `RH-NAMING-01` | Missing `use` prefix, generic name, or PascalCase hook file | `getUserData(userId)`; `useData()`; `UseScroll.ts` (should be `useScroll.ts`) |
| `RH-RETURN-01` | Inconsistent or unlabeled return | `return [data, isLoading, err, reload]` for a 4-value hook |
| `RH-DEPS-01` | Missing/incorrect deps array | `useEffect(() => fetchUser(user.id), [])` (missing `user.id`) |
| `RH-ASYNC-01` | Async hook missing loading/error | `return { data }` with no `loading`/`error` for an API call |
| `RH-CLEANUP-01` | No cancellation on unmount | `useEffect(() => { fetchData().then(setState) }, [])` (no flag) |
| `RH-STABLE-01` | New object every render | `return { data, metadata: { count: data.length } }` without memo |
| `RH-COMPOSE-01` | Reimplemented primitive instead of composing | Custom auth hook re-reading localStorage instead of using `useLocalStorage` |
| `RH-REDUCER-01` | Complex state with parallel `useState`s | Form with 5+ `useState` for values/errors/touched/submitting |
