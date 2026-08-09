# DES-SPAC-03: Element Offset Asymmetry

## Intent

A visible element's horizontal offsets (left/right gap inside its parent, its own left/right margin, or its own left/right padding) must not be dramatically asymmetric. Asymmetric horizontal spacing reads as a layout bug, breaks the page's vertical rhythm, and erodes the perception of craft. Use symmetric inline spacing or parent-driven centering unless the asymmetry is deliberate and meaningful.

## Fix

- Prefer `margin-inline: <value>` and `padding-inline: <value>` over one-sided `margin-left` / `margin-right`
- Center children with parent-driven layout (`margin-inline: auto`, flex/grid `justify-content: center`) rather than hand-tuned one-sided margins
- If an element must sit off-center, position it with `justify-self` / `align-self` / absolute positioning so the intent is explicit
- When wrapping a fixed-width child inside a fluid parent, let the parent's padding (not the child's margin) control the inset

## Code Superpowers

- For every visible element whose parent is not `<html>` or `<body>`, compute `gapLeft = element.left - (parent.left + parent.paddingLeft)` and `gapRight = (parent.right - parent.paddingRight) - element.right`
- Flag when `|gapLeft - gapRight| >= 8px` AND `max(gapLeft, gapRight) / (min(gapLeft, gapRight) + 1) >= 1.5`
- Apply the same delta + ratio test to the element's own `margin-left` vs `margin-right` and `padding-left` vs `padding-right`
- Skip when the parent is flex/grid with `justify-content` in `{space-between, space-around, space-evenly, flex-end, center}` (those intentionally redistribute space)
- Skip when the element is `position: absolute | fixed | sticky`, inside a tooltip/dropdown/modal/popover, or carries an interactive overlay role

## Common Mistakes

1. `margin-left: 8px; margin-right: 40px;` on a card that should be centered — use `margin-inline: auto` instead
2. Parent has `padding: 24px 39px` (asymmetric) so every child inherits the imbalance
3. A `.panel` with `gapLeft=24px, gapRight=39px` inside a fluid container — the extra right gap is a leftover from an old scrollbar compensation
4. Hand-tuning one-sided margin to "visually center" around an asymmetric sibling instead of fixing the sibling

## Edge Cases

- Directional UI (breadcrumbs, RTL arrows, indent markers) may be intentionally asymmetric — mark these with an explicit `justify-self` or a comment so reviewers can distinguish intent from accident
- Fluid layouts with `max-width` + `margin-inline: auto` produce symmetric gaps and must not trip this rule
- Scrollbar gutter reservation (`scrollbar-gutter: stable`) can legitimately add a small right-side gap; only flag when the delta exceeds 8px AND the ratio exceeds 1.5×

## Severity

Medium (p2) — visual polish bug, not a blocker for functionality or accessibility.

## Related

DES-SPAC-01, DES-SPAC-02, DES-CONS-02
