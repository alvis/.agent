# WT-CONTRACT-01: CSS Variable Contract with Three-Tier Fallback

## Intent

Every styled declaration in a shared component MUST resolve through a three-tier `var()` chain: `var(--component-specific, var(--active-semantic-or-ui-token, literal-default))`. The component token is the most specific override knob. Mode-sensitive colors use active `--ui-*` tokens, which `CSS-MODE-04` resolves to raw `--theme-light-*` or `--theme-dark-*` values in every branch. The literal keeps the library shippable in isolation. A missing client theme MUST NEVER render a broken UI.

## Fix

- Wrap every color, radius, spacing, shadow, and font declaration in a `var()` chain with all three tiers
- Name the component-specific token consistently (`--<component>-<state>-<property>`, e.g. `--button-primary-bg`)
- Use an active `--ui-*` token for mode-sensitive color (e.g. `--ui-accent`) and a role token for mode-independent values (e.g. `--radius-card`)
- The hardcoded default must be a real, visually acceptable value — not `initial` or `transparent` placeholders

```css
/* ❌ BAD: no semantic fallback, no hardcoded default */
.ui-button {
  background: var(--button-primary-bg);
}

/* ❌ BAD: only two tiers — semantic token has no escape hatch */
.ui-button {
  background: var(--button-primary-bg, var(--ui-accent));
}

/* ✅ GOOD: full three-tier chain */
.ui-button {
  background: var(--button-primary-bg, var(--ui-accent, #111827));
  border-radius: var(--button-radius, var(--radius-card, 0.5rem));
  height: var(--button-height, var(--spacing-control, 2.5rem));
}
```

## Code Superpowers

- Grep component styled declarations for `var\(--[^,)]+\)` (a `var()` call with no fallback) — every match is a violation. Raw→active alias assignments inside the canonical `@layer theme` block are token definitions, not styled declarations.
- Grep for `var\(--[^,]+,\s*var\(--[^,)]+\)\s*\)` (two-tier chains missing the hardcoded default) — every match is a violation
- Confirm the library compiles and renders correctly in a Storybook story that does NOT set `[data-brand]` — only the hardcoded defaults should be visible

## Common Mistakes

1. Adding the component token but forgetting the semantic fallback when first authoring a new component
2. Using `initial` or `unset` as the hardcoded default — these produce broken visuals, not safe ones
3. Pointing a mode-sensitive component color at a raw light/dark or static brand token instead of the active `--ui-*` alias

## Edge Cases

- Animation keyframes and transitions may use the resolved CSS variable without a fallback if the keyframe is only triggered when the variable is already set
- Print stylesheets may collapse to a single hardcoded value if the theme contract does not apply at print time

## Related

WT-CONTRACT-02, WT-VARIANT-02, WT-OVERRIDE-01
