# A11Y-FORM-01: Accessible Form Fields

## Intent

Every form input needs an associated `<label>`, programmatically connected help/error descriptions, validity state, and a required marker that screen readers can announce. Placeholder text is **not** a label.

## Fix

- Use `<label htmlFor={id}>` paired with `<input id={id}>`; never rely on placeholder alone
- Connect help text and error message via `aria-describedby` (space-separated id list)
- Toggle `aria-invalid` based on validation state
- Set `aria-required` when required and add a visible required marker (e.g., `*`) with `aria-label="required"`
- Render error text with `role="alert"` so it's announced when it appears

```typescript
// ✅ GOOD: complete accessible form field
export const FormField: FC<FormFieldProps> = ({
  label,
  name,
  type = 'text',
  required = false,
  helpText,
  error,
  ...props
}) => {
  const id = `field-${name}`;
  const helpId = helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ');

  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-label="required"> *</span>}
      </label>

      <input
        id={id}
        name={name}
        type={type}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? 'true' : 'false'}
        aria-required={required}
        {...props}
      />

      {helpText && <div id={helpId}>{helpText}</div>}
      {error && <div id={errorId} role="alert">{error}</div>}
    </div>
  );
};
```

## Code Superpowers

- Grep for `<input` without a sibling `<label htmlFor>` in the same component
- Check forms for `placeholder=` used as the only visible label
- Confirm error state flips `aria-invalid` and exposes `role="alert"`

## Common Mistakes

1. Placeholder-only labels (vanish when user types)
2. Floating labels that disappear without `aria-label` fallback
3. Required indicator (`*`) with no accessible name
4. `aria-describedby` pointing to ids that aren't rendered

## Related

A11Y-ARIA-01, A11Y-SEMA-01
