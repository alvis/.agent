# A11Y-SEMA-01: Semantic HTML First

## Intent

Use proper HTML elements before adding ARIA attributes. Semantic HTML provides built-in accessibility (keyboard handling, screen reader semantics, focus management) that custom `<div>`-based controls have to recreate manually and almost always get wrong. All components must meet WCAG 2.1 AA.

## Fix

- Replace `<div onClick>` button-likes with native `<button>` elements
- Replace ad-hoc `.nav` divs with `<nav>` + `<ul>`/`<li>` + `<a href>`
- Wrap page structure in `<main>`, `<article>`, `<section>` instead of styled divs
- Reach for ARIA only when no native element conveys the intended role

```typescript
// ✅ GOOD: accessible button with proper semantics
<button
  aria-label="Close dialog"
  aria-expanded={isOpen}
  onClick={handleClose}
>
  <CloseIcon aria-hidden="true" />
  Close
</button>

// ❌ BAD: inaccessible clickable div
<div onClick={handleClose} className="button-like">
  <CloseIcon />
</div>
```

## Code Superpowers

- Search for `<div[^>]*onClick` and `<span[^>]*onClick` to find non-semantic interactive elements
- Look for `className="nav"`, `className="button"`-style imitations of native elements
- Check for `role="button"` / `role="link"` that could be replaced by the native element

## Common Mistakes

1. Using `<div onClick>` instead of `<button>` for actions
2. Building navigation out of `<div>` stacks instead of `<nav>` / `<ul>` / `<a>`
3. Adding `role="button"` without keyboard handlers or focus styles
4. Skipping landmark elements (`<main>`, `<nav>`, `<aside>`) so screen readers can't jump

## Related

A11Y-KBD-01, A11Y-ARIA-01
