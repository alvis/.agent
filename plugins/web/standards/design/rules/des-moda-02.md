# DES-MODA-02: Modal Close Affordance

## Intent

Every modal must include a focusable, visible close control so pointer and keyboard users can dismiss it without guessing. Reliance on Escape alone excludes touch users; reliance on backdrop-click alone excludes screen-reader users.

## Fix

- Include a button with an `aria-label` matching `/close|dismiss/i` (e.g. `aria-label="Close dialog"`)
- Or a visible "Close" / "×" text label inside a `<button>`
- Or an element carrying `data-dismiss` / `data-close` used by the framework's modal controller
- Ensure the control is reachable by Tab and rendered above any backdrop

## Code Superpowers

- Inside every visible modal, search focusable descendants (button, `[role="button"]`, `a[href]`, `[tabindex]:not([tabindex="-1"])`)
- Flag the modal if none of them carry a close-matching `aria-label`, close-matching visible text, or a dismiss data-attribute

## Common Mistakes

1. Close affordance rendered outside the dialog subtree (breaks focus trap + screen readers)
2. Icon-only close button without an `aria-label`
3. Hidden close button (display:none) rendered but inaccessible
4. Close button disabled while loading, leaving user trapped

## Edge Cases

- Transactional confirmations (e.g. "Are you sure?") may use "Cancel" / "No" as the dismiss control — acceptable if the text clearly conveys dismissal
- Full-screen takeover experiences should still expose a close button in a predictable position

## Related

DES-MODA-01, DES-MODA-03, DES-A11Y-02
