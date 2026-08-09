# RH-COMPOSE-01: Compose Hooks From Primitives

## Intent

Build complex hooks by composing simpler, well-tested primitives (`useLocalStorage`, `useApiData`) instead of reimplementing storage, fetching, or subscription logic in every domain hook.

## Fix

- Extract reusable concerns (storage, fetching, debouncing) into primitive hooks
- Compose domain hooks (`useAuth`, `usePermissions`) on top of those primitives
- Pass derived inputs (e.g., `effectiveUserId`) into nested hooks rather than duplicating logic

```typescript
// ✅ GOOD: auth hook using localStorage hook
export function useAuth() {
  const [user, setUser] = useLocalStorage<User | null>("user", null);
  const [token, setToken] = useLocalStorage<string | null>("token", null);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await authApi.login(credentials);
    setUser(response.user);
    setToken(response.token);
  }, [setUser, setToken]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
  }, [setUser, setToken]);

  return {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!user && !!token,
  };
}

// ✅ GOOD: permissions hook building on auth hook
export function usePermissions(userId?: string) {
  const { user, isAuthenticated } = useAuth();
  const effectiveUserId = userId || user?.id;

  const { data: permissions, loading } = useApiData<Permission[]>(
    effectiveUserId && isAuthenticated ? `/users/${effectiveUserId}/permissions` : null
  );

  const hasPermission = useCallback(
    (permission: string) => permissions?.some(p => p.name === permission) ?? false,
    [permissions]
  );

  return {
    permissions: permissions || [],
    loading,
    hasPermission,
    isAdmin: hasPermission("admin"),
  };
}
```

## Code Superpowers

- Grep for direct `localStorage.getItem`/`setItem` calls in hooks; recommend `useLocalStorage`
- Grep for direct `fetch`/`axios` calls in domain hooks; recommend `useApiData`
- Identify duplicated patterns across hooks for extraction

## Common Mistakes

1. Re-reading `localStorage` directly in every domain hook
2. Re-implementing `{ data, loading, error }` orchestration in each fetcher
3. Coupling unrelated concerns into a single mega-hook instead of composing

## Edge Cases

- One-off integrations may be simpler inline than introducing a primitive
- Performance-critical paths may bypass primitives if they add unwanted re-renders

## Related

RH-ASYNC-01, RH-REDUCER-01
