# Accessibility Standards

_WCAG compliance standards for inclusive web development_

## Dependent Standards

🚨 **[IMPORTANT]** You MUST also read the following standards together with this file

- General Principles (plugin:coding:standard:universal) - Accessibility builds on fundamental coding principles of clarity, consistency, and user-centered design
- Documentation Standards (plugin:coding:standard:documentation) - All accessibility features and decisions must be properly documented for compliance and team understanding

**Note**: This standard requires the coding plugin to be enabled for referenced coding standards.

## Core Principles

### WCAG 2.1 AA Compliance

All components must meet the four fundamental accessibility principles.

```typescript
// ✅ GOOD: accessible button with proper semantics
<button
  aria-label="Close dialog"
  aria-expanded={isOpen}
  onClick={handleClose}
>
  <CloseIcon aria-hidden="true" />
  Close
</button>

// ❌ BAD: inaccessible clickable div
<div onClick={handleClose} className="button-like">
  <CloseIcon />
</div>
```

### Semantic HTML First

Use proper HTML elements before adding ARIA attributes.

```typescript
// ✅ GOOD: semantic HTML provides built-in accessibility
<button onClick={handleSubmit}>Submit Form</button>
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/home">Home</a></li>
    ...
  </ul>
</nav>
<main>
  <h1>Page Title</h1>
  <article>
    <h2>Article Title</h2>
    ...
  </article>
</main>

// ❌ BAD: non-semantic HTML reduces accessibility
<div onClick={handleSubmit}>Submit Form</div>
<div className="nav">
  <div className="nav-item">Home</div>
  ...
</div>
```

### Keyboard Navigation Support

Ensure all interactive elements are keyboard accessible.

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

## Rule Groups

- `A11Y-SEMA-*`: Semantic HTML and WCAG compliance — use proper HTML elements before ARIA, meet WCAG 2.1 AA principles.
- `A11Y-KBD-*`: Keyboard navigation — all interactive elements keyboard accessible, custom controls with proper key handlers.
- `A11Y-HEAD-*`: Heading hierarchy — logical heading order for screen reader navigation, no skipped levels.
- `A11Y-ARIA-*`: ARIA implementation — dialogs, form fields, interactive widgets with correct roles and attributes.
- `A11Y-FOCUS-*`: Focus management — modal focus trapping, focus restoration on close, escape key handling.
- `A11Y-FORM-*`: Form accessibility — label association, error states, descriptions, required indicators.
- `A11Y-COLOR-*`: Color and contrast — WCAG AA compliant ratios, no color-only indicators.
- `A11Y-SR-*`: Screen reader support — live region announcements, visually hidden content, alt text.
