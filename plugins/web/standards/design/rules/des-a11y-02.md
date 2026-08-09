# DES-A11Y-02: Accessible Names & Labels

## Intent

ARIA labels on icon-only buttons and non-standard controls. Form inputs must have associated `<label>` elements (not just placeholder). Meaningful `alt` text on images. Touch targets >=44x44 CSS px (web) / 48x48 dp (mobile).

## Fix

- Add `aria-label` to every icon-only button: `<button aria-label="Close"><CloseIcon /></button>`
- Associate every `<input>` with a `<label>` using `htmlFor`/`id` pairing or wrapping
- Provide meaningful `alt` on informational images; use `alt=""` for decorative images
- Size all touch targets to minimum 44x44px; use padding if needed to expand hit area
- Never use placeholder as the sole label — it disappears on focus

## Code Superpowers

- Check all `<button>`, `<a>` for accessible names (text content or `aria-label`)
- Check all `<img>` for `alt` attribute
- Check all `<input>` for associated `<label>` or `aria-label`
- Check touch target sizing via computed dimensions — flag if <44px

## Common Mistakes

1. Icon buttons without `aria-label` (screen reader announces nothing or "button")
2. Form inputs using placeholder as the only label
3. Images missing `alt` text entirely
4. Touch targets too small (24px icon buttons on mobile)

## Edge Cases

- Decorative images should use `alt=""` (empty string, not missing attribute)
- Complex images (charts, diagrams) may need longer `aria-describedby` descriptions

## Related

DES-A11Y-01, DES-ICON-01, DES-RESP-02
