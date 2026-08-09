# RC-STRUCT-03: Use `PropsWithChildren` for `children`

## Intent

Whenever a component accepts a `children` prop, model it with `PropsWithChildren<…>` rather than hand-rolling `children: ReactNode`. `PropsWithChildren` is the canonical React helper: it documents intent, stays in sync with React's own typing (which has subtly changed across versions for `children`), and composes cleanly with other helpers like `ComponentPropsWithoutRef<'tag'>`.

## Fix

- Wrap the rest of the props in `PropsWithChildren<{ … }>` instead of adding a `children: ReactNode` field by hand
- Compose with element props as `PropsWithChildren<ComponentPropsWithoutRef<'button'>> & { variant?: … }`
- Leave non-`children` slot props (e.g. `header`, `footer`, `icon`) typed as `ReactNode` — this rule applies only to the literal `children` field

```typescript
// ❌ BAD: hand-rolled `children: ReactNode`
export type CardProps = {
  children: ReactNode;
  variant?: 'default' | 'outlined';
};

// ✅ GOOD: `PropsWithChildren` wraps the rest
export type CardProps = PropsWithChildren<{
  variant?: 'default' | 'outlined';
}>;

// ✅ GOOD: compose with element props
export type ButtonProps = PropsWithChildren<ComponentPropsWithoutRef<'button'>> & {
  variant?: 'primary' | 'secondary';
};

// ✅ GOOD: non-`children` slots stay as `ReactNode`
export type LayoutProps = PropsWithChildren<{
  header?: ReactNode;
  footer?: ReactNode;
}>;
```

## Code Superpowers

- AST-scan exported `Props` type aliases for a property literally named `children` typed as `ReactNode` / `ReactElement` / `JSX.Element`
- Flag any `Props` type that contains `children` but does not appear inside a `PropsWithChildren<…>` wrapper
- Confirm `PropsWithChildren` is imported from `'react'` when used

## Common Mistakes

1. Typing `children: ReactNode` directly inside the Props block instead of wrapping with `PropsWithChildren`
2. Marking `children?:` optional manually — `PropsWithChildren` already makes it optional
3. Mistaking non-`children` slot props (`header`, `footer`, `icon`) for `children` and forcing them under `PropsWithChildren` — keep those as `ReactNode` fields

## Edge Cases

- Function-as-children (render props): if `children` is a function (`(value: T) => ReactNode`), `PropsWithChildren` does NOT apply — declare the function shape explicitly
- Strictly-typed children (e.g. `children: ReactElement<TabProps>`): keep the explicit narrower type; `PropsWithChildren` widens to `ReactNode`

## Related

RC-STRUCT-02, RC-STRUCT-04, RC-PROPS-01
