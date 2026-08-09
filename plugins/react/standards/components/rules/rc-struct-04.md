# RC-STRUCT-04: Extend Element Props with React Helpers

## Intent

A component that wraps a native HTML element MUST inherit that element's props via `ComponentPropsWithoutRef<'tag'>` instead of hand-rolling fields like `href`, `target`, `onClick`, `disabled`. The helper keeps the wrapper in lockstep with the DOM type (including `aria-*`, `data-*`, `ref` semantics) and lets consumers spread any valid attribute through.

## Fix

- Use `ComponentPropsWithoutRef<Tag>` as the base of any Props type whose component renders a native element and forwards extra attributes
- Intersect with a `{ … }` block for the wrapper's own props (`variant`, `tone`, etc.)
- Compose with `PropsWithChildren<…>` when the wrapper accepts children (see RC-STRUCT-03)
- Use `ComponentPropsWithRef<Tag>` ONLY when the component uses `forwardRef` and exposes a typed `ref`
- Do NOT use `JSX.IntrinsicElements['tag']` or `HTMLAttributes<HTMLXElement>` — they leak DOM-internal types and miss `aria-*`/event handler coverage that `ComponentPropsWithoutRef` provides

```typescript
// ❌ BAD: hand-rolled element fields
export type LinkProps = {
  href: string;
  target?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

// ✅ GOOD: inherit anchor props, add wrapper-specific props
export type LinkProps = ComponentPropsWithoutRef<'a'> & {
  variant?: 'primary' | 'ghost';
};

// ✅ GOOD: compose with `PropsWithChildren`
export type ButtonProps = PropsWithChildren<ComponentPropsWithoutRef<'button'>> & {
  variant?: 'primary' | 'secondary';
};

// ✅ GOOD: forwardRef call sites use `ComponentPropsWithRef`
export type InputProps = ComponentPropsWithRef<'input'> & {
  invalid?: boolean;
};
export const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => (
  <input ref={ref} {...props} />
));
```

## Code Superpowers

- Detect Props types that include any of `href`, `target`, `onClick`, `disabled`, `type`, `name`, `value`, `placeholder`, `rel`, `download` as discrete fields when the component renders a matching native element — flag absence of `ComponentPropsWithoutRef` / `ComponentPropsWithRef`
- Flag imports of `HTMLAttributes`, `AnchorHTMLAttributes`, `ButtonHTMLAttributes`, etc. in component files — these should be `ComponentPropsWithoutRef<Tag>` instead
- Flag `JSX.IntrinsicElements['tag']` usage in Props types

## Common Mistakes

1. Re-declaring DOM fields (`href`, `target`) that `ComponentPropsWithoutRef<'a'>` already provides
2. Using `ComponentPropsWithRef` everywhere "to be safe" — only `forwardRef` consumers need it; otherwise `ref` becomes spuriously typed
3. Importing `HTMLAttributes<HTMLButtonElement>` instead of `ComponentPropsWithoutRef<'button'>` (the latter is narrower and includes event handlers correctly)
4. Forgetting to intersect with the wrapper-specific props block — `ComponentPropsWithoutRef<'button'>` alone has no `variant`

## Edge Cases

- Components that do NOT wrap a single native element (composition roots, headless behavior providers) are exempt — they have no element to inherit from
- Polymorphic components (`as` prop): use a generic over the tag, e.g. `ComponentPropsWithoutRef<Tag>` with `Tag extends ElementType`
- Third-party-library wrappers: inherit from the library's exported props type, not from a native tag

## Related

RC-STRUCT-02, RC-STRUCT-03, RC-PROPS-01
