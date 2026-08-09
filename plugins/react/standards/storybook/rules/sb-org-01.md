# SB-ORG-01: Path-Based Title Organization

## Intent

Story titles must reflect component file structure for clear navigation in the Storybook sidebar. Flat titles lose context as the catalog grows.

## Fix

- Build titles as `Section/Subsection/ComponentName`, mirroring directory layout
- Top-level sections: `Components/`, `Demos/`, `Layouts/`, etc.
- Keep directory layout aligned with story titles so files are easy to locate

```typescript
// ✅ GOOD: path reflects file location
// File: components/forms/Button.stories.tsx
export default {
  title: 'Components/Forms/Button',
  component: Button,
} as Meta<typeof Button>;

// ❌ BAD: flat structure loses context
export default {
  title: 'Button',  // missing path context
  component: Button,
};
```

```plaintext
components/
  Button/
    Button.tsx
    Button.spec.tsx
    Button.stories.tsx
  Forms/
    PaymentForm/
      PaymentForm.tsx
      PaymentForm.stories.tsx
      PaymentForm.demo.stories.tsx  # Complex scenarios only
```

## Code Superpowers

- Grep `title:` strings across `*.stories.tsx`; confirm at least one `/` is present
- Audit Storybook sidebar for orphan top-level entries

## Common Mistakes

1. Flat titles (`title: 'Button'`) producing a top-level entry per component
2. Title casing drifting from directory casing
3. Multiple components reusing the same title path (collision in sidebar)

## Related

SB-NAME-01
