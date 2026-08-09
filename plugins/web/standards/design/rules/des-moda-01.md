# DES-MODA-01: Modal Accessible Name

## Intent

Every modal dialog must expose a non-empty accessible name so assistive technologies can announce its purpose when it opens. Silent modals break screen-reader flow — users hear only "dialog" with no context.

## Fix

- Set `aria-label` on the dialog root when no visible title exists
- Use `aria-labelledby` pointing to an id of visible heading text inside the dialog
- When using the native `<dialog>` element, include an `<h1>`–`<h6>` inside so the accessible name is derived from the heading

## Code Superpowers

- Scan every element matching `[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open]` — flag any whose `aria-label`, `aria-labelledby` target text, and inner heading are all empty
- Verify `aria-labelledby` ids resolve to elements present in the DOM (not stale references)

## Common Mistakes

1. Setting `role="dialog"` but omitting `aria-label` and `aria-labelledby`
2. `aria-labelledby` referring to an id that is rendered but empty (e.g. a skeleton loader)
3. Native `<dialog>` used as a bare container without any heading inside
4. Accessible name duplicates the close button (e.g. `aria-label="Close"`)

## Edge Cases

- Purely decorative modals (e.g. loading spinners) should instead use `role="alert"` with live-region text rather than `role="dialog"`
- Nested dialogs (rare) each need their own name

## Related

DES-MODA-02, DES-MODA-03, DES-A11Y-01
