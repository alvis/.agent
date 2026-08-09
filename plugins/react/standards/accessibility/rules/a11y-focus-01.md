# A11Y-FOCUS-01: Modal Focus Management

## Intent

Modals and overlays must trap focus inside, close on Escape, and restore focus to the triggering element on close. Without this, keyboard and screen-reader users get lost or stuck behind the modal backdrop.

## Fix

- Capture `document.activeElement` before opening; restore it on close
- Move focus into the dialog (`dialogRef.current?.focus()`) when it opens
- Trap Tab inside the dialog so focus cannot escape behind the overlay
- Listen for `Escape` and call `onClose`
- Set `tabIndex={-1}` on the dialog container so it can receive programmatic focus

```typescript
// ✅ GOOD: proper focus management in modal
export const Modal: FC<ModalProps> = ({ isOpen, onClose, children }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // store and move focus
      previousFocusRef.current = document.activeElement as HTMLElement;
      dialogRef.current?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'Tab') trapFocus(e, dialogRef.current);
      };

      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        previousFocusRef.current?.focus(); // restore focus
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      {children}
    </div>
  );
};
```

## Code Superpowers

- Search for `role="dialog"` components and confirm a focus-trap utility is used
- Verify `Escape` handler exists and calls `onClose`
- Check that focus is restored after dialog closes (snapshot `document.activeElement` in tests)

## Common Mistakes

1. Forgetting to restore focus on close — keyboard user lands at the top of the page
2. No Escape handler, leaving keyboard users no way out
3. Tab order leaks behind the modal because focus isn't trapped
4. Dialog container lacks `tabIndex={-1}`, so initial focus call no-ops

## Related

A11Y-ARIA-01, A11Y-KBD-01
