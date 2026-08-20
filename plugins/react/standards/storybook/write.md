# Storybook: Compliant Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies and rule groups.
> **Compliance**: Also follow `scan.md` in this directory to avoid violations during writing. When unsure about a specific rule, consult its detailed guidance in `rules/<rule-id>.md`.

## Story Implementation

### Standard Story Structure

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

### Demo Stories for Complex Scenarios

```typescript
// PaymentFlow.demo.stories.tsx - complex multi-component scenarios
import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Demos/E-Commerce/PaymentFlow',
  component: PaymentForm,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof PaymentForm>;

export default meta;
type Story = StoryObj<typeof meta>;

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

## Organization Structure

### Directory Alignment

```plaintext
components/
  Button/
    Button.tsx
    Button.stories.tsx
  Forms/
    PaymentForm/
      PaymentForm.tsx
      PaymentForm.stories.tsx
      PaymentForm.demo.stories.tsx  # Complex scenarios only
```

## Interactive Stories

### Testing User Interactions

```typescript
// ✅ GOOD: interactive story with play function
import { expect } from '@storybook/jest';
import { userEvent, within } from '@storybook/testing-library';

export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await userEvent.click(button);
    await expect(button).toBeEnabled();
  },
};

// ✅ GOOD: form interaction story
export const FormInteraction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Email');
    await userEvent.type(input, 'test@example.com');
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }));
    await expect(input).toHaveValue('test@example.com');
  },
};
```

## Controls and Documentation

### Control Configuration

```typescript
// ✅ GOOD: comprehensive control setup
import type { Meta } from '@storybook/react';

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
      description: 'Button size',
    },
    disabled: {
      control: 'boolean',
      description: 'Disable button interaction',
    },
    onClick: {
      control: false,
      description: 'Called when the button is activated',
    },
  },
  parameters: {
    docs: {
      description: {
        component: 'Primary button component for user actions',
      },
    },
  },
} satisfies Meta<typeof Button>;
```

## Patterns & Best Practices

### Complete Component Story Pattern

**Purpose**: Document all component states and variants comprehensively

**When to use**:

- Every component needs Storybook documentation
- Component has multiple variants or states
- Props need interactive exploration

**Implementation**:

```typescript
// pattern template
import type { Meta, StoryObj } from '@storybook/react';
import { ComponentName } from './ComponentName';

const meta = {
  title: 'Components/Category/ComponentName',
  component: ComponentName,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary'],
      description: 'Visual style variant',
    },
    disabled: {
      control: 'boolean',
      description: 'Disable component interaction',
    },
  },
} satisfies Meta<typeof ComponentName>;

export default meta;
type Story = StoryObj<typeof meta>;

// cover all important states
export const Default: Story = {};
export const AllVariants: Story = { args: { variant: 'secondary' } };
export const DisabledState: Story = { args: { disabled: true } };
export const EdgeCase: Story = { args: { children: 'Very long text content...' } };
```

### Common Patterns

1. **Story Composition** - Reuse stories in tests

   ```typescript
   import { composeStories } from '@storybook/react';
   import * as stories from './Button.stories';
   const { Primary } = composeStories(stories);
   ```

2. **Decorator Usage** - Add context providers

   ```typescript
   const meta = {
     component: ComponentName,
     decorators: [
       (Story) => (
         <ThemeProvider theme={defaultTheme}>
           <Story />
         </ThemeProvider>
       ),
     ],
   } satisfies Meta<typeof ComponentName>;

   export default meta;
   ```
