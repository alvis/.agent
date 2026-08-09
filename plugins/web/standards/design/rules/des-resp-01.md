# DES-RESP-01: Breakpoint Adaptation

## Intent

Layout must adapt gracefully at standard breakpoints (320, 768, 1024, 1440+). No horizontal scroll on any viewport. Content reflows rather than scales (WCAG 1.4.10: reflow at 400% zoom). Mobile-first content ordering ensures critical information appears first.

## Fix

- Define breakpoints: 320px (mobile), 768px (tablet), 1024px (desktop), 1440px+ (wide)
- Use CSS Grid or Flexbox with responsive column layouts
- No fixed-width elements that break narrow viewports — use `max-width` and relative units
- Images scale with `max-width: 100%; height: auto`
- Add `<meta name="viewport" content="width=device-width, initial-scale=1">`
- Order content mobile-first: critical content first, supplementary content later

## Code Superpowers

- Check `@media` breakpoint definitions — flag if missing mobile/tablet
- Check min-width/max-width on containers
- Verify `meta viewport` tag present
- Look for fixed-width declarations that could cause overflow

## Common Mistakes

1. Fixed-width elements (tables, images) breaking mobile layout
2. Content cut off or overflowing at narrow viewports
3. Missing viewport meta tag
4. Desktop-first content ordering that buries critical info on mobile

## Edge Cases

- Complex data tables may need horizontal scroll with a scroll indicator — acceptable as last resort
- Embedded third-party widgets may not be fully responsive

## Related

DES-RESP-02, DES-TYPO-02, DES-SPAC-01
