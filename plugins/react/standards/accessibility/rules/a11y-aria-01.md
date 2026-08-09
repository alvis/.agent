# A11Y-ARIA-01: Essential ARIA Patterns

## Intent

Add ARIA roles and attributes to dialogs, form fields, tab interfaces, and other interactive widgets so assistive technology can identify and operate them correctly.

## Fix

- Dialogs: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`
- Form fields: `aria-describedby` for help/error, `aria-invalid` for error state, `aria-required` when required
- Tabs: `role="tablist"` / `role="tab"` / `role="tabpanel"` with `aria-selected`, `aria-controls`, `aria-labelledby`
- Always pair an ARIA role with the keyboard interactions the role implies

```typescript
// ✅ GOOD: dialog with proper ARIA
<div
  role="dialog"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
  aria-modal="true"
>
  <h2 id="dialog-title">Confirm Action</h2>
  <p id="dialog-description">Are you sure you want to delete this item?</p>
  <button onClick={handleConfirm}>Yes, Delete</button>
  <button onClick={handleCancel}>Cancel</button>
</div>

// ✅ GOOD: form field with descriptions
<input
  type="email"
  id="email"
  aria-describedby="email-help email-error"
  aria-invalid={hasError}
  aria-required="true"
/>
<div id="email-help">We'll never share your email</div>
{hasError && <div id="email-error" role="alert">Please enter a valid email</div>}
```

```typescript
// ✅ GOOD: tab interface with proper roles
<div role="tablist" aria-label="Settings sections">
  <button
    role="tab"
    aria-selected={activeTab === 'general'}
    aria-controls="general-panel"
    id="general-tab"
  >
    General
  </button>
  ...
</div>

<div
  role="tabpanel"
  id="general-panel"
  aria-labelledby="general-tab"
  hidden={activeTab !== 'general'}
>
  General settings content
</div>
```

## Code Superpowers

- Grep for `role="dialog"` / `role="tab"` and confirm the matching `aria-*` attributes are present
- Run axe / Lighthouse ARIA-required-attr and aria-valid-attr-value rules
- Check that `aria-controls` / `aria-labelledby` ids exist in the DOM

## Common Mistakes

1. `role="dialog"` without `aria-modal` or label
2. `aria-describedby` referencing an id that never renders (e.g., conditional error)
3. Mixing native `<button>` with `role="button"` (redundant and confusing)

## Related

A11Y-SEMA-01, A11Y-FOCUS-01, A11Y-FORM-01
