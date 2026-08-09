# DES-CONS-01: Design Token Usage

## Intent

Use CSS custom properties (design tokens) instead of hardcoded color, spacing, and radius values. Limit `border-radius` to max 4 distinct values. Define a consistent `box-shadow`/elevation scale.

## Fix

- Define tokens: `--color-*`, `--space-*`, `--radius-*`, `--shadow-*`
- Replace all hardcoded hex/rgb/hsl colors with `var(--color-*)`
- Replace all hardcoded spacing with `var(--space-*)`
- Define radius scale: --radius-sm (4px), --radius-md (8px), --radius-lg (12px), --radius-full (9999px)
- Define elevation scale: 4 shadow levels from subtle lift to floating

## Code Superpowers

- Count `var(--*)` usage vs hardcoded values — flag low token adoption
- Extract all `border-radius` values — flag if >4 unique values
- Extract all `box-shadow` values — flag inconsistencies
- Check for hardcoded color values that should use tokens

## Common Mistakes

1. Hardcoded color values (`#3b82f6`) instead of tokens (`var(--color-primary)`)
2. Multiple border-radius values (3px, 4px, 6px, 8px, 10px, 12px) with no system
3. Inconsistent box-shadow definitions across components
4. Mixing hardcoded and token-based values in the same file

## Edge Cases

- Third-party component libraries may use their own token system — bridge with CSS custom properties
- One-off values for optical adjustments are acceptable when documented

## Related

DES-CONS-02, DES-COLR-01, DES-SPAC-01
