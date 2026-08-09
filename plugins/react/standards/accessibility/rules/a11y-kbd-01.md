# A11Y-KBD-01: Keyboard Navigation Support

## Intent

Ensure all interactive elements are keyboard accessible. Custom controls must respond to Enter and Space, expose `tabIndex={0}`, and behave like the native element they imitate.

## Fix

- For native `<button>` / `<a>`: keyboard support comes for free — prefer them (see A11Y-SEMA-01)
- For custom roles, attach `onKeyDown` handling Enter and Space and call `e.preventDefault()` before invoking the action
- Add `tabIndex={0}` so the element joins the tab order
- Provide `aria-label` (or `aria-labelledby`) so screen readers announce purpose

```typescript
// ✅ GOOD: keyboard accessible custom element
export const CustomButton: FC<Props> = ({ onClick, children }) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label="Custom action button"
    >
      {children}
    </div>
  );
};

// ❌ BAD: no keyboard support
<div onClick={onClick} className="clickable">
  {children}
</div>
```

## Code Superpowers

- Search for `onClick` handlers on non-interactive elements without an accompanying `onKeyDown`
- Check that `tabIndex` is set on every element with `role="button"` / `role="link"` / `role="tab"`
- Verify Escape closes overlays and dropdowns

## Common Mistakes

1. Missing `e.preventDefault()` on Space — page scrolls instead of activating
2. `tabIndex={-1}` left on interactive elements, removing them from tab order
3. Custom dropdowns / accordions with no keyboard handling at all
4. Tab order doesn't match the visual order

## Related

A11Y-SEMA-01, A11Y-FOCUS-01
