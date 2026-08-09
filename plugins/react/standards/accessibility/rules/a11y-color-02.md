# A11Y-COLOR-02: Color-Independent Indicators

## Intent

Never use color alone to convey state, meaning, or feedback. Colorblind users (~8% of men) cannot distinguish red/green/etc., so status must also be expressed through icon, text, shape, or pattern.

## Fix

- Pair every color-coded state with an icon and text label
- Use `role="status"` with a descriptive `aria-label` to make the state announced
- Don't strip the icon "for cleaner design" — the icon is the accessibility mechanism

```typescript
// ✅ GOOD: status with icon and text
export const StatusIndicator: FC<Props> = ({ status, message }) => {
  const getStatusIcon = (status: Status) => {
    switch (status) {
      case 'success': return <CheckIcon aria-hidden="true" />;
      case 'warning': return <WarningIcon aria-hidden="true" />;
      case 'error': return <ErrorIcon aria-hidden="true" />;
      default: return <InfoIcon aria-hidden="true" />;
    }
  };

  return (
    <div
      className={`status-${status}`}
      role="status"
      aria-label={`${status}: ${message}`}
    >
      {getStatusIcon(status)}
      <span>{message}</span>
    </div>
  );
};

// ❌ BAD: color-only indication
<div className={`status-${status}`}>{message}</div>
```

## Code Superpowers

- Grep for `className=` with status names (`error`, `success`, `warning`) and confirm the rendered output also includes an icon/text
- Audit chart palettes for color-only series differentiation; require pattern fills or shape markers

## Common Mistakes

1. Form validation that turns the border red but adds no error text/icon
2. Required-field asterisk relying on red color only
3. Charts encoding categories purely by color

## Related

A11Y-COLOR-01, A11Y-SR-01
