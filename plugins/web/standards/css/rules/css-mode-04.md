# CSS-MODE-04: Two-Tier Token Chain

## Intent

Color-mode tokens MUST form a two-tier chain. **Tier 1** is the raw per-mode palette — `--theme-light-bg`, `--theme-light-fg`, `--theme-dark-bg`, `--theme-dark-fg`, etc. **Tier 2** is the active UI semantic token — `--ui-bg`, `--ui-fg`, `--ui-border`, `--ui-muted`, etc. — which aliases the active tier-1 value inside every mode branch. Styled declarations use component override → active tier-2 UI token → literal fallback. Tier-1 raw tokens MUST NOT appear in component CSS — that bypasses the alias and prevents the mode from switching with the cascade.

## Fix

- Inventory every `var(--theme-light-…)` / `var(--theme-dark-…)` reference outside `@layer theme` and replace with the matching `--ui-…` alias
- For each new semantic role, add tier-1 entries for every mode and a tier-2 alias inside every mode branch (baseline, system-light, system-dark, explicit-light, explicit-dark)
- Remove inline mode conditionals on component selectors (e.g. `[data-theme="dark"] .card { … }`) — the alias does this work in `@layer theme`
- Name tier-2 tokens by role (`--ui-bg`, `--ui-fg`, `--ui-border`, `--ui-muted`, `--ui-accent`), not by appearance or value

## Code Superpowers

- Grep for `var\(--theme-(light|dark)-` outside the `@layer theme` block — every hit is a violation
- Grep for `\[data-theme="(light|dark)"\]\s+\.[a-z]` (mode selector followed by a component class) — likely an inline conditional
- Verify symmetry: every tier-1 token has a tier-2 alias declared in **every** mode branch
- Component CSS files should use `var(--component-*, var(--ui-*, <literal>))`; a grep for `--theme-` inside `src/components/**/*.css` should return zero

## Common Mistakes

1. Skipping the alias for one mode branch — the token silently falls back to the baseline and looks wrong in dark
2. Declaring tier-2 aliases at `:root` only, then expecting `[data-theme="dark"]` to override — it does, but missing branches (system-dark, explicit-light reset) leave gaps
3. Components reading `var(--theme-dark-bg)` directly "because it's faster" — the alias was the whole point
4. Inline mode conditionals on individual components — duplicates the contract and makes audits explode

## Compliant Example

The [canonical color-mode block](../write.md#canonical-color-mode-block) is the complete mode example: it declares raw and active tokens inside `@layer theme` for all five branches — baseline, system-light, explicit-light, system-dark, and explicit-dark. Components consume its active aliases through the full fallback chain:

```css
.card {
  background: var(--card-bg, var(--ui-bg, #ffffff));
  color: var(--card-fg, var(--ui-fg, #18181b));
}
```

## Violation Example

```css
/* ❌ component reads tier-1 directly */
.card {
  background: var(--theme-light-bg);
}

[data-theme="dark"] .card {
  background: var(--theme-dark-bg); /* ❌ inline conditional duplicates the contract */
}
```

## Edge Cases

- A computed value MAY appear in the chain, but its inputs MUST still resolve through an active tier-2 token and literal fallback: `var(--card-bg, color-mix(in oklab, var(--ui-bg, #ffffff) 80%, transparent))`.
- Charts and data visualizations define active semantic roles for series and swatches; they do not read tier-1 raw tokens from component CSS.

## Related

CSS-MODE-01, CSS-MODE-02, CSS-MODE-03, plugin:web:standard:theming
