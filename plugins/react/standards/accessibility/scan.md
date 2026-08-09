# Accessibility: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies and rule groups.

Any single P0 violation blocks approval by default.
If a violation is detected, load the matching rule guide at `./rules/<rule-id>.md` to confirm the violation and follow its fix guidance.

## Quick Scan

### Semantic HTML & WCAG Compliance

- DO NOT use non-semantic elements (e.g., `<div onClick>`) for interactive controls — use `<button>`, `<a>`, etc. [`A11Y-SEMA-01`]

### Keyboard Navigation

- DO NOT create custom interactive elements without keyboard support (Enter/Space key handlers, `tabIndex`) [`A11Y-KBD-01`]

### Heading Hierarchy

- DO NOT skip heading levels (e.g., `<h1>` followed by `<h4>`) — maintain logical order for screen readers [`A11Y-HEAD-01`]

### ARIA Implementation

- DO NOT omit ARIA attributes on dialogs, tabs, and other interactive widgets — apply correct roles and labelling [`A11Y-ARIA-01`]

### Focus Management

- DO NOT open modals without focus trapping, escape key handling, and focus restoration on close [`A11Y-FOCUS-01`]

### Form Accessibility

- DO NOT use placeholder text as the only form label — always associate `<label>` with inputs and provide descriptions/error states [`A11Y-FORM-01`]

### Color & Contrast

- DO NOT use color combinations below WCAG AA contrast (4.5:1 normal text, insufficient contrast for secondary text) [`A11Y-COLOR-01`]
- DO NOT use color as the sole indicator of state — pair color with icon and text [`A11Y-COLOR-02`]

### Screen Reader Support

- DO NOT omit `alt` text on informative images — provide descriptive alt or `alt=""` for decorative [`A11Y-SR-01`]
- DO NOT push dynamic status updates without screen reader announcements (live regions, `role="alert"`) [`A11Y-SR-02`]

## Anti-Patterns

### Missing Alt Text

```typescript
// ❌ BAD: missing alt text
<img src="chart.png" />

// ✅ GOOD: descriptive alt text
<img src="chart.png" alt="Sales increased 20% from Q1 to Q2" />
```

### Non-Semantic Interactive Elements

```typescript
// ❌ BAD: div as button without keyboard support
<div onClick={handleClick} className="button-like">Click me</div>

// ✅ GOOD: proper button element
<button onClick={handleClick}>Click me</button>
```

### Common Mistakes to Avoid

1. **Color-only indicators**
   - Problem: Colorblind users cannot distinguish states
   - Solution: Use icons, text, or patterns alongside color
   - Example: `<span className="error"><ErrorIcon /> Error message</span>`

2. **Missing form labels**
   - Problem: Screen readers cannot identify input purpose
   - Solution: Always associate labels with inputs

## Quick Reference

| Element Type | Accessibility Requirements | ARIA Attributes | Notes |
|--------------|---------------------------|------------------|-------|
| Button | Keyboard support, focus indicator | `aria-label`, `aria-expanded` | Use `<button>` element |
| Form Input | Label association, error states | `aria-describedby`, `aria-invalid` | Required `<label>` |
| Modal/Dialog | Focus trap, escape key | `role="dialog"`, `aria-modal` | Manage focus |
| Navigation | Landmark roles, skip links | `role="navigation"`, `aria-label` | Clear structure |
| Status Updates | Live region announcements | `aria-live`, `role="alert"` | Use appropriate urgency |

## Quick Decision Tree

1. **Is this interactive?**
   - If button-like → Use `<button>` element
   - If link-like → Use `<a>` element
   - If custom → Add keyboard support and ARIA

2. **Does this convey information?**
   - If status change → Use live region
   - If error state → Use `role="alert"`
   - If additional context → Use `aria-describedby`

3. **Is this visible to all users?**
   - If decorative only → Use `aria-hidden="true"`
   - If informative → Provide alt text or screen reader text
   - If interactive → Ensure keyboard accessibility
