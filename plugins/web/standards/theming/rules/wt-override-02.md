# WT-OVERRIDE-02: Use Slots / Primitives When Variables Aren't Enough

## Intent

CSS variable overrides handle visual variation. They do NOT handle structural variation (different DOM, extra elements, different element order) or behavioral variation (different click handlers, different async flows, different a11y semantics). When a client needs that kind of change, the shared component MUST expose a slot (render prop, `Slot` primitive, children), a headless primitive (behavior-only, no DOM), or be composed by a client-owned wrapper — the shared component itself is never mutated to serve one client's needs.

## Fix

- For "different content / icon" → expose a slot via `children`, a render prop, or a `Slot`-style primitive (e.g. Radix's `Slot`)
- For "different DOM structure" → ship a headless primitive (behavior + accessibility, no styled DOM) that clients compose into their own structure
- For "different behavior" → leave the shared component generic and let the client wrap it with the new behavior (`CheckoutButton` composes `Button`)
- NEVER edit the shared component to add a `if (client === 'acme') …` branch or to render an extra `<Icon>` for one consumer

```tsx
// ❌ BAD: shared component mutated to add client-specific DOM
// packages/ui/src/components/Button.tsx
export const Button: FC<ButtonProps> = ({ variant, client, children, ...props }) => (
  <button {...props}>
    {client === 'acme' && <ChevronIcon />}
    {children}
  </button>
);

// ✅ GOOD: shared component exposes a slot
// packages/ui/src/components/Button.tsx
export type ButtonProps = PropsWithChildren<ComponentPropsWithoutRef<'button'>> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  leadingIcon?: ReactNode;
};

export const Button: FC<ButtonProps> = ({ leadingIcon, children, ...props }) => (
  <button {...props}>
    {leadingIcon}
    {children}
  </button>
);

// ✅ GOOD: client composes a wrapper with new behavior
// apps/acme/src/components/CheckoutButton.tsx
import { Button, type ButtonProps } from '@company/ui';
import { LockIcon } from './LockIcon';

export const CheckoutButton: FC<Omit<ButtonProps, 'leadingIcon'>> = (props) => (
  <Button leadingIcon={<LockIcon aria-hidden />} variant="primary" {...props} />
);

// ✅ GOOD: headless primitive for total structural freedom
// packages/ui/src/primitives/useToggleBehavior.ts
export const useToggleBehavior = (initial = false) => {
  const [on, setOn] = useState(initial);
  const props = { 'aria-pressed': on, onClick: () => setOn(v => !v) };
  return { on, props };
};
```

## Code Superpowers

- Grep shared components for branching on a `client`, `brand`, or `variant` prop that controls DOM presence (not styling) — every match is a violation
- Confirm shared components do NOT import client-specific modules (icons, copy, route helpers) — if they do, the client should own the wrapper
- Confirm primitives in `packages/ui/src/primitives/` are behavior-only (no rendered DOM, or a `Slot`-style passthrough) — they must NOT bake in styled output

## Common Mistakes

1. Adding a `client` or `brand` prop to control which icon renders — should be a `leadingIcon` slot or a client wrapper
2. Re-implementing the shared component in the client app because the original "didn't support" the structural change — should expose a slot or primitive instead
3. Conflating slots with variants: a slot accepts arbitrary `ReactNode`, a variant is a closed semantic union
4. Putting client-specific DOM into the shared component's CSS via `::before { content: "Acme" }` instead of a slot

## Edge Cases

- A genuinely shared structural variant used across many clients (e.g. an optional dismiss button on every Toast) is a legitimate slot/prop on the shared component — not a client-specific change
- Some primitives (e.g. focus traps, dismissable layers) inherently render minimal DOM; that is acceptable as long as the rendered DOM is structural only and unstyled

## Related

WT-OVERRIDE-01, WT-VARIANT-01, RC-PROPS-01
