# DES-HIER-02: Task-First CTA

## Intent

Each screen/section must have one dominant primary CTA with the highest visual weight. Users must be able to identify the most important action within 3 seconds. Primary CTA follows Fitts's Law: largest interactive element, near visual focus.

## Fix

- One primary CTA per screen/section — give it distinct background color, larger size, and prominent position
- Secondary actions: smaller, muted, or outlined style
- Destructive actions: small, spatially separated from primary CTA
- Place primary CTA in the visual focus area (above fold, near content conclusion)
- Use color contrast to make CTA pop against its background

## Code Superpowers

- Verify primary button has distinct `background-color` from secondary buttons
- Check that only one element per section uses the primary button class/style
- Verify CTA is visible in viewport without scrolling (above fold check)

## Common Mistakes

1. CTA buttons blend with surrounding elements (same color/size as other buttons)
2. Multiple competing CTAs in the same section
3. Primary CTA hidden below the fold or buried in content
4. Destructive actions (delete/cancel) styled as prominently as primary actions

## Edge Cases

- Multi-step wizards may have both "Next" (primary) and "Back" (secondary) — only "Next" should be primary
- Pricing tables may have one "recommended" plan CTA styled as primary

## Related

DES-HIER-01, DES-COLR-01, DES-STAT-02
