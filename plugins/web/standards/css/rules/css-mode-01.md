# CSS-MODE-01: Selector Contract for Color Modes

## Intent

Use `:root[data-theme="light"]` and `:root[data-theme="dark"]` as the **only** explicit color-mode selectors. The brand axis is a separate attribute (`data-brand`, owned by `plugin:web:standard:theming`). Class-based dark-mode toggles (`.dark`) and alternate attribute names (`data-mode`, `data-color-scheme`, `data-color-mode`, `data-appearance`) are forbidden — they fragment the contract and conflict with other plugins.

## Fix

- Replace any `html.dark`, `body.dark`, or `.dark &` selector with `:root[data-theme="dark"]`
- Replace `[data-mode="…"]`, `[data-color-scheme="…"]`, or `[data-appearance="…"]` with `[data-theme="…"]`
- If a Tailwind config enables `darkMode: 'class'`, switch to `darkMode: ['selector', '[data-theme="dark"]']` (v4 syntax) so utilities match the standard
- Keep brand variation on `data-brand` — never overload `data-theme` with brand values
- Apply attribute selectors at `:root`, not at descendant nodes — color mode is a root-level concern

## Code Superpowers

- Grep for `\.dark\b` in stylesheets and JSX/TSX `className` props — every hit is suspect
- Grep for `data-mode=`, `data-color-scheme=`, `data-appearance=`, `data-color-mode=` in HTML/JSX
- Grep for Tailwind config `darkMode:\s*'class'` and confirm it now points at `[data-theme="dark"]`
- Inspect runtime `<html>` element — the only color-mode attribute should be `data-theme`

## Common Mistakes

1. Migrating from Tailwind's default `.dark` class without updating CSS selectors authored alongside utilities
2. Inventing `data-color-scheme` because it "matches the CSS property name" — the contract is `data-theme`
3. Stacking `data-theme="acme-dark"` to mean "brand acme + dark mode" — split into `data-brand="acme"` and `data-theme="dark"`
4. Applying `[data-theme="dark"]` on `<body>` instead of `<html>` — breaks `color-scheme` inheritance for native UA chrome

## Compliant Example

```css
:root[data-theme="dark"] {
  color-scheme: dark;
  --ui-bg: var(--theme-dark-bg);
  --ui-fg: var(--theme-dark-fg);
}
```

```html
<html data-brand="acme" data-theme="dark">
  …
</html>
```

## Violation Example

```css
/* ❌ class-based toggle */
html.dark {
  --ui-bg: #000;
}

/* ❌ wrong attribute name */
:root[data-mode="dark"] {
  --ui-bg: #000;
}

/* ❌ brand and mode collapsed onto one attribute */
:root[data-theme="acme-dark"] {
  --ui-bg: #000;
}
```

## Edge Cases

- Third-party widgets that hard-code `.dark` may need a thin compatibility shim (`:root[data-theme="dark"] .third-party { … }`) — note this in the exception register, not in core styles.

## Related

CSS-MODE-02, CSS-MODE-03, CSS-MODE-04, plugin:web:standard:theming
