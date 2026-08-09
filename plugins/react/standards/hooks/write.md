# React Hooks: Compliant Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies and rule groups.
> **Compliance**: Also follow `scan.md` in this directory to avoid violations during writing. When unsure about a specific rule, consult its detailed guidance in `rules/<rule-id>.md`.

## File Naming

Hook files use `camelCase.ts` starting with lowercase `use`. The file basename must match the exported hook identifier and start with `use` so React's lint rules (`react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps`) detect them. See `RH-NAMING-01`.

```plaintext
✅ GOOD:
hooks/useScroll.ts
hooks/useUserData.ts
hooks/useLocalStorage.ts

❌ BAD:
hooks/UseScroll.ts      # PascalCase — rename to useScroll.ts
hooks/use-scroll.ts     # kebab-case — rename to useScroll.ts
hooks/scroll.ts         # missing `use` prefix
```

## Data Fetching Hooks

### Async Data Pattern

Standardized pattern for data fetching with loading, error, and success states.

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

## Storage & Persistence

### Local Storage Pattern

```typescript
// ✅ GOOD: type-safe localStorage with error handling
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn(`localStorage error:`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
}
```

## Performance Optimization

### Debouncing Pattern

```typescript
// ✅ GOOD: debounce value with cleanup
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// ✅ GOOD: debounced callback with cancellation
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(((...args) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }) as T, [callback, delay]);
}
```

## Hook Composition

### Building Composable Hooks

Combine simple hooks to create more powerful, reusable functionality.

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

## Complex State Management

### Form Hook with Reducer

Use useReducer for complex state management with multiple related state updates.

```typescript
// ✅ GOOD: form state with reducer pattern
interface FormState<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
}

type FormAction<T> =
  | { type: "SET_VALUE"; field: keyof T; value: T[keyof T] }
  | { type: "SET_ERROR"; field: keyof T; error: string }
  | { type: "RESET"; initialValues: T };

function formReducer<T>(state: FormState<T>, action: FormAction<T>): FormState<T> {
  switch (action.type) {
    case "SET_VALUE":
      return {
        ...state,
        values: { ...state.values, [action.field]: action.value },
        errors: { ...state.errors, [action.field]: undefined },
      };
    case "SET_ERROR":
      return {
        ...state,
        errors: { ...state.errors, [action.field]: action.error },
      };
    case "RESET":
      return {
        values: action.initialValues,
        errors: {},
        touched: {},
        isSubmitting: false,
      };
    default:
      return state;
  }
}

export function useForm<T extends Record<string, any>>(initialValues: T) {
  const [state, dispatch] = useReducer(formReducer, {
    values: initialValues,
    errors: {},
    touched: {},
    isSubmitting: false,
  } as FormState<T>);

  const setValue = useCallback((field: keyof T, value: T[keyof T]) => {
    dispatch({ type: "SET_VALUE", field, value });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET", initialValues });
  }, [initialValues]);

  return { ...state, setValue, reset };
}
```

## Quick Reference

| Hook Type | Pattern | Return Type | Use Case |
|-----------|---------|-------------|----------|
| Data Fetching | `useApiData<T>` | `{data, loading, error}` | API calls |
| Storage | `useLocalStorage<T>` | `[value, setValue]` | Persist data |
| Performance | `useDebounce<T>` | `T` | Delay updates |
| State | `useReducer` | `[state, dispatch]` | Complex state |
| Composition | `useAuth + usePermissions` | Custom interface | Layered functionality |

## Patterns & Best Practices

### Hook Template Pattern

**Purpose**: Consistent structure for async data hooks

**When to use**:

- API data fetching
- Any async operation with loading states
- Reusable data access patterns

**Implementation**:

```typescript
// pattern template
export function useAsyncHook<T>(param: string) {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({ data: null, loading: false, error: null });

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const result = await someAsyncOperation(param);
      setState({ data: result, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
    }
  }, [param]);

  useEffect(() => { execute(); }, [execute]);

  return { ...state, refetch: execute };
}
```

### Common Patterns

1. **Cleanup Pattern** - Prevent memory leaks

   ```typescript
   useEffect(() => {
     let cancelled = false;
     fetchData().then(data => {
       if (!cancelled) setState(data);
     });
     return () => { cancelled = true; };
   }, []);
   ```

2. **Stable References** - Prevent unnecessary re-renders

   ```typescript
   const callback = useCallback((id: string) => {
     updateItem(id);
   }, [updateItem]);
   ```

## Quick Decision Tree

1. **Need to share logic between components?**
   - If yes → Create custom hook
   - If simple state → Use built-in hooks
   - If complex state → Consider useReducer

2. **Hook involves async operations?**
   - If yes → Include loading, error, and success states
   - If data fetching → Use standard async pattern
   - If side effects → Ensure proper cleanup

3. **Hook returns multiple values?**
   - If array-like → Return array (like useState)
   - If object-like → Return object (like useForm)
   - If single value → Return value directly
