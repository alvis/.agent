# DES-A11Y-01: Keyboard & Focus

## Intent

All interactive elements must be keyboard-accessible (Tab, Enter, Escape). Visible focus indicators on every focusable element. Never use `outline: none` without a `:focus-visible` replacement. Include skip-navigation link for keyboard users.

## Fix

- Ensure all interactive elements are reachable via Tab key in logical order
- Add visible focus styles: `outline: 2px solid var(--color-primary); outline-offset: 2px` on `:focus-visible`
- If removing default outline, always provide a `:focus-visible` replacement
- Add skip-navigation link as the first focusable element: `<a href="#main" class="sr-only focus:not-sr-only">Skip to main content</a>`
- Ensure Escape closes modals/overlays and returns focus to trigger element

## Code Superpowers

- Look for `outline: none` / `outline: 0` without `:focus-visible` replacement
- Check all custom interactive elements for `tabindex` and keyboard event handlers
- Verify modal/dialog components trap focus and restore on close
- Check for skip-navigation link presence

## Common Mistakes

1. `outline: none` on all elements in global reset without replacement
2. Custom components (dropdowns, accordions) not keyboard-accessible
3. Focus trapped in modals without Escape handler
4. Tab order doesn't match visual order

## Edge Cases

- Canvas-based applications may need custom keyboard handling
- Drag-and-drop interfaces need keyboard alternatives

## Related

DES-A11Y-02, DES-STAT-02, DES-COLR-02
