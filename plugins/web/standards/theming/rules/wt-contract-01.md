# WT-CONTRACT-01: CSS Variable Contract with Three-Tier Fallback

## Intent

Every styled declaration in a shared component MUST resolve through a three-tier `var()` chain: `var(--component-specific, var(--semantic-token, hardcoded-default))`. The component token is the most specific override knob, the semantic token is the brand-wide palette, and the hardcoded default keeps the library shippable in isolation. A missing client theme MUST NEVER render a broken UI.

## Fix

- Wrap every color, radius, spacing, shadow, and font declaration in a `var()` chain with all three tiers
- Name the component-specific token consistently (`--<component>-<state>-<property>`, e.g. `--button-primary-bg`)
- Name the semantic token from the library's `@theme` contract (e.g. `--color-brand`, `--radius-card`)
- The hardcoded default must be a real, visually acceptable value — not `initial` or `transparent` placeholders

```css
/* ❌ BAD: no semantic fallback, no hardcoded default */
.ui-button {
  background: var(--button-primary-bg);
}

/* ❌ BAD: only two tiers — semantic token has no escape hatch */
.ui-button {
  background: var(--button-primary-bg, var(--color-brand));
}

/* ✅ GOOD: full three-tier chain */
.ui-button {
  background: var(--button-primary-bg, var(--color-brand, #111827));
  border-radius: var(--button-radius, var(--radius-card, 0.5rem));
  height: var(--button-md-height, 2.5rem);
}
```

## Code Superpowers

- Grep component CSS files for `var\(--[^,)]+\)` (a `var()` call with no fallback) — every match is a violation
- Grep for `var\(--[^,]+,\s*var\(--[^,)]+\)\s*\)` (two-tier chains missing the hardcoded default) — every match is a violation
- Confirm the library compiles and renders correctly in a Storybook story that does NOT set `[data-brand]` — only the hardcoded defaults should be visible

## Common Mistakes

1. Adding the component token but forgetting the semantic fallback when first authoring a new component
2. Using `initial` or `unset` as the hardcoded default — these produce broken visuals, not safe ones
3. Pointing the component token directly at a literal color instead of routing through a semantic token first

## Edge Cases

- Animation keyframes and transitions may use the resolved CSS variable without a fallback if the keyframe is only triggered when the variable is already set
- Print stylesheets may collapse to a single hardcoded value if the theme contract does not apply at print time

## Related

WT-CONTRACT-02, WT-VARIANT-02, WT-OVERRIDE-01
