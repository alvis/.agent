# WT-VARIANT-02: Variant Visuals Resolve Through CSS Variables

## Intent

When a component switches variants, the only thing that changes in the JSX/TSX is which CSS class is applied (`ui-button--primary` vs `ui-button--ghost`). The visual difference between variants — colors, radii, borders — MUST resolve through CSS variables, not through literal colors or pixel values baked into the component CSS. This keeps the variant system orthogonal to the theme: any client can re-skin all four variants by overriding the same set of variables, with zero changes to the component or its variant CSS.

## Fix

- Each variant class (`.ui-button--primary`) sets the component-specific CSS variables that the base class consumes
- Avoid bare literal colors or pixel values inside variant CSS — assign component tokens through active semantic/UI tokens with terminal literal fallbacks
- The base component class consumes the variables via the three-tier chain (`WT-CONTRACT-01`)

```css
/* ❌ BAD: variant bakes in literal color and radius */
.ui-button--primary {
  background: #ff6600;
  border-radius: 999px;
}

.ui-button--ghost {
  background: transparent;
  color: #ff6600;
}

/* ✅ GOOD: variant points at variables; literals live nowhere but the contract defaults */
.ui-button {
  background: var(--button-bg, var(--ui-accent, #111827));
  color: var(--button-fg, var(--ui-on-accent, #ffffff));
  border: 1px solid var(--button-border, var(--ui-border, transparent));
  border-radius: var(--button-radius, var(--radius-card, 0.5rem));
}

.ui-button--primary {
  --button-bg: var(--ui-accent, #111827);
  --button-fg: var(--ui-on-accent, #ffffff);
}

.ui-button--ghost {
  --button-bg: var(--ui-bg, transparent);
  --button-fg: var(--ui-accent, #111827);
  --button-border: var(--ui-accent, #111827);
}

.ui-button--danger {
  --button-bg: var(--ui-danger, #b91c1c);
  --button-fg: var(--ui-on-danger, #ffffff);
}
```

Variant classes define component-token values, so they use active UI → literal
resolution. The base styled declarations add the outer component tier and are
the only place visual properties are applied.

## Code Superpowers

- Grep variant class selectors (`.<component>--<variant>`) for visual-property declarations or component-token assignments to bare literals. A literal is valid only as the terminal fallback of an active semantic/UI token.
- Confirm every variant class only re-assigns CSS variables (or applies a one-off non-themable property like `text-decoration`)
- Verify that active `--ui-*` aliases switch between raw light/dark tokens and re-skin all variants without touching component CSS

## Common Mistakes

1. Authoring a new variant by copy-pasting the base class and editing colors inline
2. Using `!important` to force a variant override instead of fixing the variable plumbing
3. Conditional className with literal Tailwind colors (`primary ? 'bg-orange-600' : 'bg-gray-900'`) — should be `bg-brand` / `bg-muted` resolving through `@theme`

## Edge Cases

- Decorative properties unique to one variant (e.g. an underline on `ghost`, an icon position on `danger`) may use literal values when those properties are not themable
- High-contrast / forced-colors mode may override variant resolution with system colors — this is expected browser behavior, not a violation

## Related

WT-CONTRACT-01, WT-VARIANT-01, WT-TAILWIND-01
