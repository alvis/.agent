# DES-TYPO-01: Type Scale Consistency

## Intent

Typography drives visual hierarchy. Use a systematic type scale (ratio 1.125–1.333) with maximum 2–3 typeface families. Font weights must be used purposefully to reinforce hierarchy, not applied randomly.

## Fix

- Choose 1–2 typeface families (one for headings, one for body, or a single versatile family)
- Define a ratio-based scale: 1.25 (Major Third) recommended — Display 36px > H1 30px > H2 24px > H3 20px > Body 16px > Small 14px > Tiny 12px
- Use font weights deliberately: 700 for headings, 600 for subheadings, 400 for body
- Never use arbitrary font sizes — every size must come from the scale

## Code Superpowers

- Extract all `font-family` declarations — flag if >3 unique families
- Check `font-size` values — flag if not following a ratio-based scale (1.125–1.333)
- Verify `font-weight` usage is purposeful — flag random weight distribution

## Common Mistakes

1. Too many fonts or weights with no system (4+ families)
2. Arbitrary font sizes that don't follow a scale
3. Insufficient contrast between heading sizes (H2 and H3 look the same)
4. Random bolding that doesn't reinforce hierarchy

## Edge Cases

- Code blocks may use a monospace family as a third typeface — this is acceptable
- Icon fonts count as a separate family but are not typographic

## Related

DES-TYPO-02, DES-HIER-01, DES-CONS-01
