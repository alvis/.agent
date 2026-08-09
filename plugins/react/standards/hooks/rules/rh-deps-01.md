# RH-DEPS-01: Complete Dependency Arrays

## Intent

Every value read inside `useEffect`, `useCallback`, `useMemo` from the surrounding scope must appear in the dependency array. Missing dependencies cause stale closures and silent bugs.

## Fix

- Enable and obey `react-hooks/exhaustive-deps` ESLint rule
- Add all referenced props, state, and derived values to the deps array
- For functions used inside effects, wrap them with `useCallback` so they can be safely listed
- If a value should be excluded, restructure (e.g., move outside, use `useRef`) — never silence the rule

```typescript
// ❌ BAD: missing user.id in dependency array
function useBadEffect(user: User) {
  useEffect(() => {
    fetchUserData(user.id).then(setData);
  }, []); // missing user.id dependency
}

// ✅ GOOD: include all dependencies
function useGoodEffect(user: User) {
  useEffect(() => {
    fetchUserData(user.id).then(setData);
  }, [user.id]);
}

// ✅ GOOD: correct dependencies via useCallback
export function useUserData(userId: string) {
  const [userData, setUserData] = useState<User | null>(null);

  const refreshUser = useCallback(async () => {
    if (!userId) return;
    const user = await fetchUser(userId);
    setUserData(user);
  }, [userId]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  return { userData, refreshUser };
}
```

## Code Superpowers

- Configure ESLint with `react-hooks/exhaustive-deps: error`
- Grep for `// eslint-disable-next-line react-hooks/exhaustive-deps` and audit each one

## Common Mistakes

1. Empty deps `[]` "to run once" while reading props/state inside
2. Listing only some deps to "avoid loops" instead of fixing the root cause
3. Including objects/arrays that are recreated every render (causes infinite re-runs)

## Edge Cases

- Mount-only effects with truly no closure dependencies are fine with `[]`
- For values that should not retrigger but must stay current, use `useRef`

## Related

RH-CLEANUP-01, RH-STABLE-01
