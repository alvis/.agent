# DES-COLR-02: WCAG Contrast

## Intent

All text and UI components must meet WCAG AA contrast minimums. Normal text >=4.5:1, large text (>=18px bold or >=24px) >=3:1, UI components and graphical objects >=3:1.

## Fix

- Test all text/background pairs against WCAG AA thresholds
- Use high-contrast neutral pairs for body text (e.g., neutral-900 on white = ~15:1)
- Ensure colored text on colored backgrounds meets ratios
- For disabled elements: while WCAG doesn't require contrast on disabled controls, aim for 3:1 minimum for discoverability
- Verify focus indicators have >=3:1 contrast against adjacent colors

## Code Superpowers

- Calculate contrast ratios for all text/background pairs — flag WCAG AA failures
- Check border/outline contrast on interactive elements
- Verify placeholder text contrast (often fails — should meet 4.5:1)
- Test focus ring contrast against both the element and surrounding background

## Common Mistakes

1. Low contrast text on colored backgrounds (light gray on white, white on light blue)
2. Placeholder text with insufficient contrast
3. Focus indicators that don't contrast with adjacent colors
4. Colored badges/tags with unreadable text

## Edge Cases

- Decorative text (purely visual, not informational) may be exempt
- Logos and brand marks have no contrast requirement
- Incidental text in photographs is exempt

## Related

DES-COLR-01, DES-A11Y-01, DES-A11Y-02
