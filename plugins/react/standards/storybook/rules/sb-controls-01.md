# SB-CONTROLS-01: Comprehensive Control Configuration

## Intent

Configure `argTypes` so designers and PMs can explore every prop interactively, and disable controls for non-serializable values like functions.

## Fix

- For enums: `control: 'select'` with `options: [...]`
- For booleans: `control: 'boolean'`
- For numbers: `control: 'range'` with `{ min, max, step }`
- For colors: `control: 'color'`
- For functions / complex objects: `control: false` to hide the (unusable) input
- Add a `description` for each prop and a component-level `parameters.docs.description.component`

```typescript
// ✅ GOOD: comprehensive control setup
const meta = {
  title: 'Components/UI/Button',
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger'],
      description: 'Visual style variant',
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
    },
    disabled: {
      control: 'boolean',
      description: 'Disable button interaction',
    },
    onClick: { control: false }, // disable control for functions
  },
  parameters: {
    docs: {
      description: {
        component: 'Primary button component for user actions',
      },
    },
  },
};
```

## Code Superpowers

- Lint stories: every prop on the component should have an `argTypes` entry or be disabled explicitly
- Check that function props use `control: false`
- Confirm component-level docs description exists on every `Components/*` story

## Common Mistakes

1. Function props left with auto-generated controls (renders unusable input)
2. Enum props without `options`, leaving the user a freeform string field
3. Missing `description` on argTypes — Docs tab shows just the prop name

## Related

SB-STRUCT-01, SB-COVERAGE-01
