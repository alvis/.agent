# WT-CONTRACT-02: Semantic Tokens Go in `@theme`, Component Tokens Go in Plain CSS

## Intent

Tailwind v4.3's `@theme` block is special: every token inside it generates a utility class (`--color-brand` produces `bg-brand`, `text-brand`, `border-brand`; `--radius-card` produces `rounded-card`). That is the right home for tokens that participate in the brand-wide palette. It is the WRONG home for per-component tokens (`--button-primary-bg`, `--button-md-height`) — those should not generate utility classes, and dropping them into `@theme` pollutes the utility surface and confuses overrides.

## Fix

- Put tokens that should generate Tailwind utilities into `@theme` (`--color-*`, `--radius-*`, `--shadow-*`, `--font-*`, `--spacing-*`)
- Put per-component tokens into plain CSS variable declarations inside `@layer components` (or at `:root` if globally shared but component-scoped in intent)
- When a component-level token "wants" to be a semantic token, promote it: rename it and move it into `@theme`

```css
/* ❌ BAD: per-component tokens in @theme — these don't need utility classes */
@theme {
  --color-brand: #111827;
  --button-primary-bg: #111827;    /* WRONG: component token */
  --button-md-height: 2.5rem;      /* WRONG: component token */
}

/* ❌ BAD: semantic token declared outside @theme — no Tailwind utility generated */
:root {
  --color-brand: #111827;
}

/* ✅ GOOD: clean split */
@theme {
  --color-brand: #111827;
  --radius-card: 0.5rem;
  --font-sans: "Inter", system-ui, sans-serif;
}

@layer components {
  .ui-button {
    --button-primary-bg: var(--color-brand);
    --button-md-height: 2.5rem;
    background: var(--button-primary-bg, var(--color-brand, #111827));
    height: var(--button-md-height, 2.5rem);
  }
}
```

## Code Superpowers

- Grep `@theme { … }` blocks for token names matching `--<component>-` patterns (`--button-`, `--card-`, `--input-`) — every match is a violation
- Grep `:root { … }` or top-level `:where(:root)` blocks for `--color-*`, `--radius-*`, `--shadow-*`, `--font-*` declarations — these belong in `@theme`
- Confirm every declared semantic token produces a Tailwind utility class in the built output (`bg-<name>`, `rounded-<name>`, etc.)

## Common Mistakes

1. Dropping every CSS variable into `@theme` "to keep them together" — pollutes utility namespace
2. Declaring semantic tokens in `:root` because the team is unfamiliar with Tailwind v4.3 `@theme` syntax
3. Mixing semantic and component tokens in the same block, making it unclear which generate utilities

## Edge Cases

- Project-wide design tokens that are NOT meant to be Tailwind utilities (e.g. arbitrary motion durations the team prefers to opt-out of utility generation for) may live in plain CSS — but flag in code review that they could be `@theme` candidates
- Generated tokens (build-time or runtime) follow the same split: semantic → `@theme`, component → plain CSS

## Related

WT-CONTRACT-01, WT-TAILWIND-01
