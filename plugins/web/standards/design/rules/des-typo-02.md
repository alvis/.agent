# DES-TYPO-02: Readability

## Intent

Text must be comfortable to read across all devices. Body line-height 1.4–1.6, heading line-height 1.1–1.3, line length 50–75 characters, minimum 14px body on mobile.

## Fix

- Set body `line-height: 1.5` (1.4–1.6 range)
- Set heading `line-height: 1.2` (1.1–1.3 range)
- Constrain content containers to `max-width: 65ch` for optimal readability
- Minimum body font size: 16px desktop, 14px mobile
- Use sufficient paragraph spacing (1em or --space-4 between paragraphs)

## Code Superpowers

- Check `line-height` on body text — flag if <1.3 or >1.8
- Measure container widths at body font size — flag if >75ch
- Check `font-size` on mobile viewport — flag if body <14px
- Verify `max-width` exists on text-heavy containers

## Common Mistakes

1. Body text <14px on mobile (hard to read)
2. Line length >80 characters (hard to scan back to next line)
3. Line-height too tight on body text (<1.3)
4. No max-width on content containers, causing full-viewport line lengths

## Edge Cases

- Data tables may have denser typography by necessity — acceptable at 13–14px with tighter line-height
- Code blocks may use smaller font sizes with different line-height rules

## Related

DES-TYPO-01, DES-RESP-01
