# DES-CONS-02: Component Reuse

## Intent

Same purpose = same style across all screens. Components, naming, and interaction patterns must be consistent. Users should transfer understanding from one screen to all others (concept constancy).

## Fix

- Use the same component for the same purpose everywhere (one button style for primary actions, one for secondary)
- Maintain consistent naming: same concept = same label
- Stable interaction patterns: same gesture = same result across screens
- Consistent terminology in navigation, labels, and microcopy
- Reuse component variants rather than creating one-off styles

## Code Superpowers

- Check component class naming patterns for consistency
- Compare button/input/card styles across different pages — flag divergent implementations
- Search for duplicate component definitions that should be shared

## Common Mistakes

1. Multiple button styles for the same action type (3 different "save" buttons)
2. Different border-radius on similar card elements across screens
3. Inconsistent terminology (Settings vs Preferences vs Configuration)
4. Same gesture producing different results in different contexts

## Edge Cases

- Intentional variation for distinct product areas (admin vs user-facing) is acceptable with clear design system documentation
- Experimental/prototype features may temporarily diverge

## Related

DES-CONS-01, DES-COPY-01, DES-BRND-01
