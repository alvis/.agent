# WT-TAILWIND-01: Tailwind v4.3 `@theme` Block Owns the Semantic Token Contract

## Intent

In Tailwind v4.3, the `@theme { … }` block is the authoritative declaration of the design-token contract — it generates utility classes AND publishes the names client apps override. The shared library MUST declare its semantic tokens inside `@theme` in `packages/ui/src/styles/theme.css`. Client apps override the same names under `[data-brand="…"]`. Component CSS must live under `@layer components` so cascade order remains predictable. There is exactly one source of truth for "what tokens this library exposes", and it is the library's `@theme` block.

## Fix

- Declare semantic tokens (`--color-*`, `--radius-*`, `--shadow-*`, `--font-*`, `--spacing-*`) inside the library's `@theme { … }` block
- Place every component CSS rule inside `@layer components { … }`
- Import Tailwind at the top of `theme.css` (`@import "tailwindcss";`) BEFORE the `@theme` block
- Client `[data-brand="…"]` blocks live in the client's own `theme.css`, NOT in the library

```css
/* ❌ BAD: semantic tokens declared outside @theme — no utility generated, no contract */
:root {
  --color-brand: #111827;
  --radius-card: 0.5rem;
}

.ui-button { background: var(--color-brand); }

/* ❌ BAD: component CSS outside @layer components — cascade order undefined */
.ui-button {
  background: var(--color-brand, #111827);
}

/* ✅ GOOD: library theme.css */
/* packages/ui/src/styles/theme.css */
@import "tailwindcss";

@theme {
  --color-brand: #111827;
  --color-surface: #ffffff;
  --color-text: #0a0a0a;
  --radius-card: 0.5rem;
  --shadow-card: 0 1px 2px rgb(0 0 0 / 0.06);
  --font-sans: "Inter", system-ui, sans-serif;
}

/* ✅ GOOD: library component CSS */
/* packages/ui/src/components/Button.css */
@layer components {
  .ui-button {
    background: var(--button-primary-bg, var(--color-brand, #111827));
    border-radius: var(--button-radius, var(--radius-card, 0.5rem));
  }
}

/* ✅ GOOD: client override */
/* apps/acme/src/theme.css */
[data-brand="acme"] {
  --color-brand: #ff6600;
  --radius-card: 999px;
}
```

## Code Superpowers

- Grep the library for `:root { … }` declarations containing `--color-*`, `--radius-*`, `--shadow-*`, `--font-*` — these belong in `@theme`
- Grep library component CSS for top-level class declarations NOT wrapped in `@layer components { … }` — every match is a violation
- Confirm the library exports exactly one `@theme` block from its entry stylesheet; multiple `@theme` blocks fragment the contract

## Common Mistakes

1. Maintaining a legacy `:root { --color-… }` block alongside `@theme` after a Tailwind v3 → v4 migration
2. Wrapping `@theme` inside a `:where(:root)` or media query — `@theme` is a Tailwind directive, not a CSS selector
3. Declaring component CSS without `@layer components`, then debugging unexpected cascade issues
4. Letting client apps add tokens to the library's `@theme` instead of overriding under `[data-brand]`

## Edge Cases

- Tailwind v4.3 ships a default `@theme` with built-in tokens; the library's `@theme` extends/overrides those names
- Build tools that strip CSS layers (some PostCSS pipelines) need `@layer` preserved for the cascade contract to hold; confirm your bundler keeps layers

## Related

WT-CONTRACT-02, WT-TAILWIND-02, WT-VARIANT-02
