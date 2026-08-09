# CSS-MODE-02: System Mode Resolves Without JavaScript

## Intent

System mode is the **absence** of `data-theme` on `:root`. CSS alone — `:root:not([data-theme])` qualified by `@media (prefers-color-scheme: light|dark)` — picks the correct branch on first paint. JavaScript MUST NOT read `matchMedia` to apply a class or attribute at boot, and the default markup MUST NOT ship with `data-theme="light"` (or `"dark"`) — that erases system mode and forces a manual reset.

## Fix

- Remove any boot-time script that calls `window.matchMedia('(prefers-color-scheme: dark)')` and toggles a class on `<html>`
- Ship `<html>` with **no** `data-theme` attribute by default; only set it when the user makes an explicit choice
- Wrap dark-only declarations as `@media (prefers-color-scheme: dark) { :root:not([data-theme]) { … } }` — never as a bare media query
- Persist the user's explicit choice in `localStorage` and apply it as `data-theme="…"`; deleting the value returns to system

## Code Superpowers

- Grep for `matchMedia\(.*prefers-color-scheme` in client bundles — any hit at boot is suspect
- Grep for `data-theme=\"(light|dark)\"` in server-rendered HTML defaults
- Grep for `@media (prefers-color-scheme: dark)` blocks lacking a `:root:not([data-theme])` qualifier
- Inspect first-paint `<html>` element in tests — `data-theme` should be absent for system-mode fixtures

## Common Mistakes

1. Defaulting `data-theme="light"` server-side "just in case" — dark-mode users now flash to light
2. Bare `@media (prefers-color-scheme: dark)` blocks that override `data-theme="light"` whenever the OS is dark
3. Reading `localStorage` synchronously in `<head>` and writing a class — keeps JS in the critical path of theming
4. Treating system as a third stored value (`"system"`) instead of "no attribute set"

## Compliant Example

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    color-scheme: dark;
    --ui-bg: var(--theme-dark-bg);
    --ui-fg: var(--theme-dark-fg);
  }
}
```

```html
<!-- system mode: no attribute -->
<html>…</html>

<!-- explicit override: attribute present -->
<html data-theme="dark">…</html>
```

## Violation Example

```html
<!-- ❌ default override erases system mode -->
<html data-theme="light">…</html>
```

```css
/* ❌ no :root:not([data-theme]) qualifier — overrides explicit choice */
@media (prefers-color-scheme: dark) {
  :root {
    --ui-bg: #000;
  }
}
```

```javascript
// ❌ JS-driven system detection
if (matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.classList.add('dark');
}
```

## Edge Cases

- A "Reset to system" UI control MUST remove the `data-theme` attribute (e.g. `element.removeAttribute('data-theme')`), not set it to `"system"`.

## Related

CSS-MODE-01, CSS-MODE-03, CSS-MODE-04
