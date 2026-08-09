# DES-MODA-03: Modal Escape Dismissal

## Intent

Pressing the Escape key must dismiss every open modal so keyboard-only users can exit without hunting for a close button. Escape is the WAI-ARIA dialog pattern's default dismissal affordance — violating it breaks muscle memory across the entire web.

## Fix

- Attach a keydown listener that closes the modal when `event.key === 'Escape'`
- Native `<dialog>` elements implement this automatically — prefer them over hand-rolled overlays
- Remove the listener on unmount to prevent leaked handlers
- Ensure Escape propagates only to the topmost modal when nested

## Code Superpowers

- After detecting a newly-opened modal, press Escape and observe: if the modal remains visible (via `offsetParent !== null` and matching selectors), flag it
- Distinct from DES-MODA-02: this rule is Python-side behavioral; only set when the dialog refuses Escape dismissal

## Common Mistakes

1. `onKeyDown` listener bound to the trigger button instead of the modal / document
2. `event.preventDefault()` swallowed by an outer handler before the modal sees Escape
3. Modal open-state derived from route state that Escape does not mutate
4. Keyboard handler scoped to a specific input, leaving the surrounding modal unresponsive

## Edge Cases

- Unsaved-changes modals may confirm before dismissal — acceptable if Escape triggers the confirm flow, not if it does nothing
- Critical blocking modals (e.g. fraud verification) may intentionally disable Escape — document this explicitly and prefer a visible "Continue / Cancel" choice

## Related

DES-MODA-01, DES-MODA-02, DES-A11Y-02
