# React Component Template

_Complete boilerplate template for React components with TypeScript, testing, and Storybook_

## Basic Component Template

### Component Implementation

````typescript
// ComponentName.tsx
import type { ComponentPropsWithoutRef, FC, PropsWithChildren } from 'react';

/**
 * Props for the ComponentName component
 * Brief description of what this component does
 */
export type ComponentNameProps = PropsWithChildren<ComponentPropsWithoutRef<'button'>> & {
  /** Primary variant of the component */
  variant?: 'primary' | 'secondary' | 'tertiary';

  /** Size of the component */
  size?: 'small' | 'medium' | 'large';
};

/**
 * ComponentName provides [brief description of functionality]
 *
 * @example
 * ```tsx
 * <ComponentName variant="primary" onClick={handleClick}>
 *   Click me
 * </ComponentName>
 * ```
 */
export const ComponentName: FC<ComponentNameProps> = ({
  variant = 'primary',
  size = 'medium',
  disabled = false,
  className = '',
  children,
  ...buttonProps
}) => {
  const componentClasses = [
    'component-name',
    `component-name--${variant}`,
    `component-name--${size}`,
    disabled && 'component-name--disabled',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      {...buttonProps}
      type="button"
      className={componentClasses}
      disabled={disabled}
      aria-disabled={disabled}
    >
      {children}
    </button>
  );
};
````

### Storybook Stories Template

```typescript
// ComponentName.stories.tsx
import { expect, jest } from '@storybook/jest';
import { userEvent, within } from '@storybook/testing-library';

import { ComponentName } from './ComponentName';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Components/ComponentName',
  component: ComponentName,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A flexible component that provides [brief description]. Supports multiple variants, sizes, and accessibility features.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'tertiary'],
      description: 'Visual variant of the component'
    },
    size: {
      control: { type: 'select' },
      options: ['small', 'medium', 'large'],
      description: 'Size of the component'
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Whether the component is disabled'
    },
    onClick: {
      control: false,
      description: 'Callback fired when component is clicked'
    },
    className: {
      control: { type: 'text' },
      description: 'Additional CSS class names'
    },
    'aria-label': {
      control: { type: 'text' },
      description: 'Accessible label for screen readers'
    },
    children: {
      control: { type: 'text' },
      description: 'Content to display inside the component'
    }
  }
} satisfies Meta<typeof ComponentName>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  args: {
    children: 'Default Component'
  }
};

// Variant stories
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Component'
  }
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Component'
  }
};

export const Tertiary: Story = {
  args: {
    variant: 'tertiary',
    children: 'Tertiary Component'
  }
};

// Size stories
export const Small: Story = {
  args: {
    size: 'small',
    children: 'Small Component'
  }
};

export const Medium: Story = {
  args: {
    size: 'medium',
    children: 'Medium Component'
  }
};

export const Large: Story = {
  args: {
    size: 'large',
    children: 'Large Component'
  }
};

// State stories
export const Disabled: Story = {
  args: {
    disabled: true,
    onClick: jest.fn(),
    children: 'Disabled Component'
  },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button');
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  }
};

// Accessibility story
export const WithAriaLabel: Story = {
  args: {
    'aria-label': 'Custom accessible description',
    children: 'Component with ARIA label'
  },
  parameters: {
    docs: {
      description: {
        story: 'Example showing how to provide accessible labels for screen readers.'
      }
    }
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button');
    await expect(button).toHaveAccessibleName('Custom accessible description');
  }
};

// Interactive example
export const Interactive: Story = {
  args: {
    children: 'Click me!',
    onClick: jest.fn()
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive example with click handler. Try clicking the component!'
      }
    }
  },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Click me!' });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  }
};

// All variants showcase
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <ComponentName variant="primary">Primary</ComponentName>
      <ComponentName variant="secondary">Secondary</ComponentName>
      <ComponentName variant="tertiary">Tertiary</ComponentName>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Showcase of all available component variants.'
      }
    }
  }
};

// All sizes showcase
export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <ComponentName size="small">Small</ComponentName>
      <ComponentName size="medium">Medium</ComponentName>
      <ComponentName size="large">Large</ComponentName>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Showcase of all available component sizes.'
      }
    }
  }
};
```

## Advanced Component Template

### Component with Custom Hook

```typescript
// useComponentLogic.ts
import { useState, useCallback } from 'react';

export interface UseComponentLogicOptions {
  initialValue?: boolean;
  onChange?: (value: boolean) => void;
}

export const useComponentLogic = ({
  initialValue = false,
  onChange
}: UseComponentLogicOptions = {}) => {
  const [isActive, setIsActive] = useState(initialValue);

  const toggle = useCallback(() => {
    const newValue = !isActive;
    setIsActive(newValue);
    onChange?.(newValue);
  }, [isActive, onChange]);

  const activate = useCallback(() => {
    if (!isActive) {
      setIsActive(true);
      onChange?.(true);
    }
  }, [isActive, onChange]);

  const deactivate = useCallback(() => {
    if (isActive) {
      setIsActive(false);
      onChange?.(false);
    }
  }, [isActive, onChange]);

  return {
    isActive,
    toggle,
    activate,
    deactivate
  };
};

// AdvancedComponent.tsx
import type { ComponentPropsWithoutRef, FC, PropsWithChildren } from 'react';

export type AdvancedComponentProps = PropsWithChildren<
  Omit<ComponentPropsWithoutRef<'button'>, 'aria-pressed' | 'onClick'>
> & {
  initialActive?: boolean;
  onStateChange?: (active: boolean) => void;
};

export const AdvancedComponent: FC<AdvancedComponentProps> = ({
  initialActive = false,
  onStateChange,
  className = '',
  children,
  ...buttonProps
}) => {
  const { isActive, toggle } = useComponentLogic({
    initialValue: initialActive,
    onChange: onStateChange
  });

  return (
    <button
      {...buttonProps}
      type="button"
      className={`advanced-component ${isActive ? 'active' : ''} ${className}`}
      onClick={toggle}
      aria-pressed={isActive}
    >
      {children}
    </button>
  );
};
```

### Compound Component Template

```typescript
// Card compound component example
import { createContext, useContext } from 'react';

import type { ComponentPropsWithoutRef, FC, PropsWithChildren } from 'react';

interface CardContextValue {
  variant: 'default' | 'elevated' | 'outlined';
}

export type CardProps = PropsWithChildren<ComponentPropsWithoutRef<'div'>> & {
  variant?: 'default' | 'elevated' | 'outlined';
};

export type CardHeaderProps = PropsWithChildren<ComponentPropsWithoutRef<'header'>>;

export type CardBodyProps = PropsWithChildren<ComponentPropsWithoutRef<'div'>>;

export type CardFooterProps = PropsWithChildren<ComponentPropsWithoutRef<'footer'>>;

const CardContext = createContext<CardContextValue | null>(null);

export const Card: FC<CardProps> & {
  Header: FC<CardHeaderProps>;
  Body: FC<CardBodyProps>;
  Footer: FC<CardFooterProps>;
} = ({ variant = 'default', children, className = '', ...divProps }) => {
  const contextValue = { variant };

  return (
    <CardContext.Provider value={contextValue}>
      <div {...divProps} className={`card card--${variant} ${className}`}>
        {children}
      </div>
    </CardContext.Provider>
  );
};

// Card sub-components
const CardHeader: FC<CardHeaderProps> = ({ children, className = '', ...headerProps }) => {
  const { variant } = useCardContext();

  return (
    <header {...headerProps} className={`card__header card__header--${variant} ${className}`}>
      {children}
    </header>
  );
};

const CardBody: FC<CardBodyProps> = ({ children, className = '', ...divProps }) => {
  const { variant } = useCardContext();

  return (
    <div {...divProps} className={`card__body card__body--${variant} ${className}`}>
      {children}
    </div>
  );
};

const CardFooter: FC<CardFooterProps> = ({ children, className = '', ...footerProps }) => {
  const { variant } = useCardContext();

  return (
    <footer {...footerProps} className={`card__footer card__footer--${variant} ${className}`}>
      {children}
    </footer>
  );
};

const useCardContext = () => {
  const context = useContext(CardContext);
  if (!context) {
    throw new Error('Card compound components must be used within a Card');
  }
  return context;
};

// Attach sub-components
Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
```

## Template Checklist

When creating a new component using this template:

✅ **Component Requirements**:

- [ ] Props type alias exported
- [ ] Component uses FC type with arrow function
- [ ] Default props defined with destructuring
- [ ] Proper TypeScript types for all props
- [ ] JSDoc documentation for complex props

✅ **Accessibility Requirements**:

- [ ] Proper semantic HTML elements
- [ ] ARIA attributes where needed
- [ ] Keyboard navigation support
- [ ] Screen reader friendly labels
- [ ] Focus management for interactive elements

✅ **Storybook Requirements**:

- [ ] Default story with basic props
- [ ] Stories for all variants/sizes
- [ ] Accessibility example story
- [ ] Interactive example with controls
- [ ] Interaction behavior and assertions implemented in `.stories.tsx` `play()` functions
- [ ] Accessibility attributes, edge cases, and error states asserted in stories
- [ ] Documentation descriptions added

✅ **Performance Considerations**:

- [ ] Memoization added if needed (React.memo, useMemo, useCallback)
- [ ] Event handlers stable between renders
- [ ] No unnecessary re-renders
- [ ] Lazy loading for heavy components
