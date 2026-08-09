# A11Y-HEAD-01: Heading Hierarchy

## Intent

Maintain logical heading order for screen reader navigation. Headings form the document outline screen readers use to jump between sections; skipped or out-of-order levels make pages unnavigable for assistive tech users.

## Fix

- Start every page with exactly one `<h1>`
- Increase one level at a time: `h1` → `h2` → `h3`; never jump from `h1` straight to `h4`
- Use heading levels for *structure*, not visual size — restyle with CSS, not by picking a different `<hN>`
- Wrap related headings in `<section>` / `<article>` to make the outline explicit

```typescript
// ✅ GOOD: proper heading hierarchy
<main>
  <h1>Main Page Title</h1>
  <section>
    <h2>Section Title</h2>
    <article>
      <h3>Article Title</h3>
      <h4>Subsection</h4>
    </article>
  </section>
</main>

// ❌ BAD: skipped heading levels
<main>
  <h1>Main Page Title</h1>
  <h4>Should be h2</h4>  // Skipped h2, h3
  <h2>Out of order</h2>
</main>
```

## Code Superpowers

- Run an axe / Lighthouse heading-order check against rendered pages
- Grep templates for adjacent `<h1>` and `<h3>`/`<h4>` with no intermediate level
- Confirm only one `<h1>` exists per route

## Common Mistakes

1. Using `<h4>` because it "looks the right size" instead of styling an `<h2>`
2. Multiple `<h1>` on the same page
3. Heading order broken by composing components that each emit their own `<h1>`

## Related

A11Y-SEMA-01
