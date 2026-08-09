# WT-VARIANT-02: Variant Visuals Resolve Through CSS Variables

## Intent

When a component switches variants, the only thing that changes in the JSX/TSX is which CSS class is applied (`ui-button--primary` vs `ui-button--ghost`). The visual difference between variants — colors, radii, borders — MUST resolve through CSS variables, not through literal colors or pixel values baked into the component CSS. This keeps the variant system orthogonal to the theme: any client can re-skin all four variants by overriding the same set of variables, with zero changes to the component or its variant CSS.

## Fix

- Each variant class (`.ui-button--primary`) sets the component-specific CSS variables that the base class consumes
- Avoid declaring literal colors or pixel values inside variant CSS — point at semantic tokens or component tokens instead
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
  background: var(--button-bg, var(--color-brand, #111827));
  color: var(--button-fg, var(--color-surface, #ffffff));
  border-radius: var(--button-radius, var(--radius-card, 0.5rem));
}

.ui-button--primary {
  --button-bg: var(--color-brand);
  --button-fg: var(--color-surface);
}

.ui-button--ghost {
  --button-bg: transparent;
  --button-fg: var(--color-brand);
  --button-border: 1px solid currentColor;
}

.ui-button--danger {
  --button-bg: var(--color-danger);
  --button-fg: var(--color-surface);
}
```

## Code Superpowers

- Grep variant class selectors (`.<component>--<variant>`) for hex codes, `rgb(…)`, `hsl(…)`, or px values — every match is a violation
- Confirm every variant class only re-assigns CSS variables (or applies a one-off non-themable property like `text-decoration`)
- Verify that overriding `--color-brand` under `[data-brand="acme"]` re-skins ALL variants without touching variant CSS

## Common Mistakes

1. Authoring a new variant by copy-pasting the base class and editing colors inline
2. Using `!important` to force a variant override instead of fixing the variable plumbing
3. Conditional className with literal Tailwind colors (`primary ? 'bg-orange-600' : 'bg-gray-900'`) — should be `bg-brand` / `bg-muted` resolving through `@theme`

## Edge Cases

- Decorative properties unique to one variant (e.g. an underline on `ghost`, an icon position on `danger`) may use literal values when those properties are not themable
- High-contrast / forced-colors mode may override variant resolution with system colors — this is expected browser behavior, not a violation

## Related

WT-CONTRACT-01, WT-VARIANT-01, WT-TAILWIND-01
