# CSS-MODE-03: Layer Placement and `color-scheme`

## Intent

Color-mode tokens — and the `color-scheme` declarations that pair with them — MUST live inside `@layer theme`. The cascade layer makes precedence predictable across the brand layer, app overrides, and component CSS. Every mode branch (baseline, system-light, system-dark, explicit-light, explicit-dark) MUST set `color-scheme: light` or `color-scheme: dark` so native UA chrome — scrollbars, form controls, `<input type="date">` pickers, autofill backgrounds — themes correctly.

## Fix

- Wrap all color-mode declarations in a single `@layer theme { … }` block at the top of the theme stylesheet
- Set `color-scheme: light;` or `color-scheme: dark;` inside **every** mode branch, including the `:root` baseline
- Keep `color-scheme` next to its companion `--ui-*` aliases — same selector, same layer
- Remove any unlayered `:root { … }` color-mode blocks; move their contents into `@layer theme`

## Code Superpowers

- Grep for `--theme-` or `--ui-` declarations and confirm each lives inside `@layer theme`
- Grep for `color-scheme:` and confirm one appears in every mode branch (`:root`, `[data-theme="light"]`, `[data-theme="dark"]`, and both `prefers-color-scheme` branches)
- Inspect computed style of `:root` in DevTools — `color-scheme` should resolve to `light` or `dark`, never `normal`
- Verify scrollbars, `<input type="date">`, and form-control autofill match the active mode visually

## Common Mistakes

1. Declaring tokens at an unlayered `:root` — app utility classes can no longer override predictably
2. Setting `color-scheme` once on `html { color-scheme: light dark; }` outside the layer — UA chrome stops following the active mode after a toggle
3. Forgetting `color-scheme` in the explicit `:root[data-theme="dark"]` branch — scrollbars stay light while content goes dark
4. Splitting tokens between `@layer base` and `@layer theme` — the contract becomes order-sensitive across imports

## Compliant Example

```css
@layer theme {
  :root[data-theme="dark"] {
    color-scheme: dark;

    --ui-bg: var(--theme-dark-bg);
    --ui-fg: var(--theme-dark-fg);
  }
}
```

## Violation Example

```css
/* ❌ unlayered — precedence is unpredictable */
:root[data-theme="dark"] {
  --ui-bg: #09090b;
}

/* ❌ color-scheme missing — native controls stuck in light */
@layer theme {
  :root[data-theme="dark"] {
    --ui-bg: var(--theme-dark-bg);
    --ui-fg: var(--theme-dark-fg);
  }
}
```

## Edge Cases

- If a brand layer also uses `@layer theme`, append additional rules — do not introduce a sibling layer for the same concern.
- `color-scheme: light dark;` is acceptable **only** on the unscoped `html` element as a hint outside the theme block; inside `@layer theme` mode branches, declare the single active value.

## Related

CSS-MODE-01, CSS-MODE-02, CSS-MODE-04, plugin:web:standard:theming
