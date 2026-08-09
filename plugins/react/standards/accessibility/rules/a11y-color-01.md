# A11Y-COLOR-01: Color Contrast (WCAG AA)

## Intent

Text and UI must meet WCAG AA contrast minimums so users with low vision can read content. Light grays on white and pale text colors are the most common failures.

## Fix

- Verify contrast ratios meet WCAG AA: 4.5:1 for normal text, 3:1 for large text and UI components
- Define a token palette with verified ratios; reuse tokens instead of ad-hoc hex values
- For secondary/disabled text, still hit at least 4.5:1 against its actual background

```typescript
// ✅ GOOD: WCAG AA compliant colors
const colors = {
  primary: "#0066cc",    // 4.5:1 contrast ratio
  success: "#28a745",    // High contrast
  danger: "#dc3545",     // 4.5:1 against white
  textPrimary: "#212529", // High contrast
  textSecondary: "#6c757d", // Meets AA standard
} as const;

// ❌ BAD: insufficient contrast
const badColors = {
  lightGray: "#e9ecef",  // Too light for text
  paleText: "#999999",   // Below 4.5:1 ratio
};
```

## Code Superpowers

- Run automated contrast checks (axe, Lighthouse, Stark) over rendered pages
- Audit token files: every text/background pair should have a documented ratio
- Watch for hardcoded grays in CSS that bypass the token system

## Common Mistakes

1. `#999` on `#fff` — fails AA for body text
2. Brand color used for text on white when only certified for UI components (3:1)
3. Hover/disabled states ignored in the audit
4. Light text on busy photographic backgrounds without scrim/overlay

## Related

A11Y-COLOR-02
