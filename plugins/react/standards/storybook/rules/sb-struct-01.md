# SB-STRUCT-01: Standard Story Structure

## Intent

Use the canonical `Meta` + `StoryObj` typed structure with `tags: ['autodocs']` so Storybook generates type-safe stories and documentation pages consistently across the catalog.

## Fix

- Import `Meta` and `StoryObj` from `@storybook/react`
- Define `meta` with `satisfies Meta<typeof Component>` for type safety
- Export it as default and derive `type Story = StoryObj<typeof meta>`
- Add `tags: ['autodocs']` so the docs page auto-renders
- For multi-component scenarios, use a `.demo.stories.tsx` file with `parameters: { layout: 'fullscreen' }` and a `render` function

```typescript
// complete story template with all recommended features
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta = {
  title: 'Components/UI/Button',
  component: Button,
  tags: ['autodocs'],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// essential stories
export const Primary: Story = {
  args: { variant: 'primary', children: 'Click me' },
};

export const Disabled: Story = {
  args: { disabled: true, children: 'Disabled' },
};

export const WithClick: Story = {
  args: {
    children: 'Interactive',
    onClick: () => console.log('clicked'),
  },
};
```

```typescript
// PaymentFlow.demo.stories.tsx - complex multi-component scenarios
const meta = {
  title: 'Demos/E-Commerce/PaymentFlow',
  parameters: { layout: 'fullscreen' },
};

export const CompleteCheckout: Story = {
  render: () => (
    <PaymentProvider>
      <OrderSummary {...orderProps} />
      <PaymentForm onSubmit={handlePayment} />
      ...
    </PaymentProvider>
  ),
};
```

## Code Superpowers

- Grep for `as Meta<typeof` instead of `satisfies Meta<typeof` (older, less safe pattern)
- Confirm every story file declares `type Story = StoryObj<typeof meta>` once
- Check `tags: ['autodocs']` is present for component stories

## Common Mistakes

1. Untyped `meta` losing argTypes inference
2. Missing `tags: ['autodocs']` so the docs page is empty
3. Using `render` for simple variants when `args` would suffice

## Related

SB-ORG-01, SB-COVERAGE-01, SB-CONTROLS-01
