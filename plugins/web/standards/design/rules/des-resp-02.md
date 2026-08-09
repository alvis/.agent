# DES-RESP-02: Mobile Optimization

## Intent

Touch targets >=44px on mobile. Primary actions placed in thumb zone. Touch-friendly alternatives for hover-only interactions. Mobile experience must be a first-class citizen, not a desktop afterthought.

## Fix

- Size all touch targets to minimum 44x44 CSS px; use padding to expand hit area if needed
- Place primary actions in the thumb zone (bottom third of screen on mobile)
- Replace hover-based interactions (tooltips, previews) with tap/long-press alternatives
- Space touch targets with sufficient gaps to prevent accidental taps
- Consider bottom navigation or floating action buttons for mobile

## Code Superpowers

- Check touch target sizing via computed dimensions — flag if <44px
- Look for hover-only interactions without touch fallback (`@media (hover: hover)`)
- Verify tap target spacing (minimum 8px gap between adjacent targets)

## Common Mistakes

1. Tiny tap targets on mobile (24px icon buttons)
2. Primary actions at the top of the screen (out of thumb reach)
3. Hover-only interactions with no mobile alternative
4. Adjacent touch targets too close together (accidental taps)

## Edge Cases

- Text links within paragraphs may be smaller than 44px — ensure line-height provides adequate vertical target
- Density-sensitive interfaces (spreadsheets, code editors) may use smaller targets with an explicit density toggle

## Related

DES-RESP-01, DES-A11Y-02, DES-HIER-02
