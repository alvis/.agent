# RC-STATE-02: Context for Deep Prop Drilling

## Intent

When the same value is threaded through 3+ component layers, replace prop drilling with a Context provider. Split contexts by concern to prevent unnecessary re-renders.

## Fix

- Identify props passed through intermediate components that don't use them
- Create a focused `Context` (e.g., `UserContext`, `ThemeContext`) and provide at the appropriate scope
- Split frequently-changing values into their own context to avoid re-rendering all consumers

```typescript
// ✅ GOOD: context for deep prop drilling
const UserContext = createContext<User | null>(null);

export const UserProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
};
```

## Code Superpowers

- Trace prop paths; flag any prop forwarded through ≥ 3 components without being read
- Detect monolithic contexts that bundle unrelated state — recommend splitting

## Common Mistakes

1. Putting all global state in a single mega-context
2. Using Context for state that changes every keystroke without memoization
3. Re-creating the provider value object on every render (causes all consumers to re-render)

## Edge Cases

- For very deep but performance-sensitive subtrees, an external store (Zustand/Redux) may be preferable to Context

## Related

RC-STATE-01, RC-PERF-01
