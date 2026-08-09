# WT-OVERRIDE-01: Override via Scoped CSS Variables, Not Forks or Branded Props

## Intent

When a client app — or one feature within a client app — needs a shared component to look different, the correct tool is a scoped CSS variable override: declare a scope class (`.checkout-flow`, `.marketing-hero`) and re-bind the component's variables under it. Forking the component, adding a `client="acme"` prop, or introducing one-off boolean flags (`isMarketingHeroButton`) is forbidden — every fork or branded prop is a permanent maintenance tax and a leak of brand identity into the type system. The variable contract exists exactly so re-skins are zero-cost.

## Fix

- For a feature-scoped re-skin, declare a scope class and override the component's variables inside it
- For an app-wide re-skin, use the client `theme.css` `[data-brand="…"]` block (`WT-TAILWIND-01`)
- For a one-off button with different copy or icon but same variant, render the same `<Button variant="primary">` inside the scoped class
- If the variation cannot be expressed by variables alone, escalate to `WT-OVERRIDE-02` (slot, primitive, or wrapper) — never fork

```css
/* ✅ GOOD: feature-scoped variable override */
/* apps/acme/src/features/checkout/CheckoutFlow.css */
.checkout-flow {
  --button-primary-bg: #2563eb;
  --button-radius: 0.25rem;
}
```

```tsx
// ✅ GOOD: scope class wraps the buttons; no component changes
export const CheckoutFlow: FC<PropsWithChildren> = ({ children }) => (
  <section className="checkout-flow">
    <Button variant="primary">Pay now</Button>
    {children}
  </section>
);
```

```tsx
// ❌ BAD: branded prop leaks client identity into the shared API
<Button variant="primary" client="acme" />

// ❌ BAD: one-off boolean flag
<Button variant="primary" isMarketingHeroButton />

// ❌ BAD: forked component
// apps/acme/src/components/MarketingButton.tsx
// (a copy of @company/ui/Button.tsx with edited colors)
```

## Code Superpowers

- Grep component Props types for prop names that look like brand or campaign identifiers (`client`, `brand`, `campaign`, `isMarketing*`, `isHero*`) — every match is a violation
- Grep client codebases for files named `<ClientName><Component>.tsx` that re-export or copy a library component — likely forks
- Search for `import { Button } from '@company/ui'` immediately followed by a styled wrapper that re-skins it without adding new behavior — should be a scoped class instead

## Common Mistakes

1. Adding a `client` or `brand` prop "temporarily" to ship a campaign on time; it never leaves
2. Forking a component into the client app because the dev did not know variables could be overridden under a scope class
3. Using `!important` on a scoped class instead of overriding the component's variables cleanly
4. Scoping with an element selector (`section .ui-button { background: … }`) instead of a named class and variable override — fragile and breaks if the DOM changes

## Edge Cases

- A scoped class CAN combine variable overrides with locally-scoped layout/spacing rules unique to that feature, as long as the component itself is untouched
- If the same scope appears in three or more features, promote it to a documented `[data-scope="…"]` pattern or revisit whether the variation should become a semantic variant

## Related

WT-CONTRACT-01, WT-VARIANT-01, WT-OVERRIDE-02
