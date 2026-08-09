# DES-HIER-01: Clear Visual Weight Hierarchy

## Intent

Every screen must show distinct primary/secondary/tertiary visual levels via size, color, position, and whitespace. Users should be able to scan content following a clear F-pattern or Z-pattern reading flow. CRAP principles (contrast, repetition, alignment, proximity) must be applied to every composition.

## Fix

- Use heading scale to establish hierarchy: Display > H1 > H2 > H3 > Body
- Assign visual weight proportional to element importance — largest/boldest for primary, progressively smaller for secondary/tertiary
- Apply whitespace to create breathing room and separate visual groups
- Align to a clear grid; maintain consistent alignment across all elements
- Use proximity to group related items; separate unrelated items with generous whitespace

## Code Superpowers

- Check `font-size`, `font-weight` distribution — ensure heading scale exists with clear differentiation
- Check `z-index` layering for logical stacking order
- Verify that visual containers use consistent alignment patterns
- Check for orphaned elements with no clear group association

## Common Mistakes

1. Everything looks equally important — flat hierarchy with no visual weight differentiation
2. Decorative elements compete with content for attention
3. No clear reading flow or scanning path
4. Whitespace used randomly rather than intentionally to create hierarchy

## Edge Cases

- Dashboard layouts may have multiple equally-weighted metric cards intentionally
- Marketing hero sections may use large decorative elements alongside CTAs (ensure CTA still dominates)

## Related

DES-HIER-02, DES-TYPO-01, DES-SPAC-02
