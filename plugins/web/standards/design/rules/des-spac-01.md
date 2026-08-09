# DES-SPAC-01: Spacing Scale Adherence

## Intent

All spacing (margin, padding, gap) must follow a 4px/8px grid system. No arbitrary values. Content containers must have `max-width` for readability. Elements must align to the grid with zero pixel drift.

## Fix

- Use spacing tokens: --space-1 (4px), --space-2 (8px), --space-3 (12px), --space-4 (16px), --space-6 (24px), --space-8 (32px), --space-12 (48px)
- Set `max-width` on content containers (e.g., 65ch for text, 1200px for page)
- Align all elements to the grid — no 1-2px drift
- Use CSS Grid or Flexbox gap for consistent inter-element spacing

## Code Superpowers

- Extract all `margin`, `padding`, `gap` values — flag values not on 4px grid
- Check for inconsistent spacing on similar components
- Verify `max-width` on content containers for readability
- Flag arbitrary values like 5px, 7px, 13px, 15px

## Common Mistakes

1. Arbitrary spacing values (5px here, 7px there, 13px elsewhere)
2. "Almost the same" spacing between similar elements (14px vs 16px)
3. No max-width on content containers, causing 2000px line lengths on wide screens
4. Elements misaligned by 1-2px due to inconsistent spacing

## Edge Cases

- 2px values acceptable for hairline borders and subtle visual separators
- Optical alignment adjustments (e.g., nudging icons by 1px) are acceptable when grid alignment looks wrong

## Related

DES-SPAC-02, DES-CONS-01
