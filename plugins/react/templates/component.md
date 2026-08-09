# React Component Template

_Complete boilerplate template for React components with TypeScript, testing, and Storybook_

## Basic Component Template

### Component Implementation

````typescript
// ComponentName.tsx
import type { FC, ReactNode } from 'react';

/**
 * Props for the ComponentName component
 * Brief description of what this component does
 */
export interface ComponentNameProps {
  /** Primary variant of the component */
  variant?: 'primary' | 'secondary' | 'tertiary';

  /** Size of the component */
  size?: 'small' | 'medium' | 'large';

  /** Whether the component is disabled */
  disabled?: boolean;

  /** Click handler for interactive components */
  onClick?: () => void;

  /** Additional CSS class names */
  className?: string;

  /** Accessible label for screen readers */
  'aria-label'?: string;

  /** Child elements to render inside the component */
  children: ReactNode;
}

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
  onClick,
  className = '',
  'aria-label': ariaLabel,
  children
}) => {
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  const componentClasses = [
    'component-name',
    `component-name--${variant}`,
    `component-name--${size}`,
    disabled && 'component-name--disabled',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={componentClasses}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-disabled={disabled}
    >
      {children}
    </button>
  );
};
````

### Test File Template

```typescript
// ComponentName.spec.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentName, type ComponentNameProps } from './ComponentName';

const defaultProps: ComponentNameProps = {
  children: 'Test Component'
};

const renderComponentName = (props: Partial<ComponentNameProps> = {}) => {
  return render(<ComponentName {...defaultProps} {...props} />);
};

describe('rc:ComponentName', () => {
  it('should render with children', () => {
    const expectedText = 'Custom Content';

    renderComponentName({ children: expectedText });

    expect(screen.getByRole('button')).toHaveTextContent(expectedText);
  });

  it('should apply variant classes correctly', () => {
    renderComponentName({ variant: 'secondary' });

    const button = screen.getByRole('button');
    expect(button).toHaveClass('component-name--secondary');
  });

  it('should apply size classes correctly', () => {
    renderComponentName({ size: 'large' });

    const button = screen.getByRole('button');
    expect(button).toHaveClass('component-name--large');
  });

  it('should handle click events', () => {
    const mockClick = vi.fn();

    renderComponentName({ onClick: mockClick });

    fireEvent.click(screen.getByRole('button'));
    expect(mockClick).toHaveBeenCalledOnce();
  });

  it('should handle keyboard events', () => {
    const mockClick = vi.fn();

    renderComponentName({ onClick: mockClick });

    const button = screen.getByRole('button');

    // Test Enter key
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(mockClick).toHaveBeenCalledTimes(1);

    // Test Space key
    fireEvent.keyDown(button, { key: ' ' });
    expect(mockClick).toHaveBeenCalledTimes(2);
  });

  it('should not call onClick when disabled', () => {
    const mockClick = vi.fn();

    renderComponentName({ onClick: mockClick, disabled: true });

    fireEvent.click(screen.getByRole('button'));
    expect(mockClick).not.toHaveBeenCalled();
  });

  it('should apply disabled attributes', () => {
    renderComponentName({ disabled: true });

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveClass('component-name--disabled');
  });

  it('should apply custom className', () => {
    const customClass = 'custom-test-class';

    renderComponentName({ className: customClass });

    expect(screen.getByRole('button')).toHaveClass(customClass);
  });

  it('should apply aria-label', () => {
    const ariaLabel = 'Custom accessible label';

    renderComponentName({ 'aria-label': ariaLabel });

    expect(screen.getByRole('button')).toHaveAttribute('aria-label', ariaLabel);
  });

  it('should have proper default props', () => {
    renderComponentName();

    const button = screen.getByRole('button');
    expect(button).toHaveClass('component-name--primary');
    expect(button).toHaveClass('component-name--medium');
    expect(button).not.toBeDisabled();
  });
});
```

### Storybook Stories Template

```typescript
// ComponentName.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { ComponentName } from './ComponentName';

const meta: Meta<typeof ComponentName> = {
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
      action: 'clicked',
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
};

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
    children: 'Disabled Component'
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
  }
};

// Interactive example
export const Interactive: Story = {
  args: {
    children: 'Click me!',
    onClick: () => alert('Component clicked!')
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive example with click handler. Try clicking the component!'
      }
    }
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

export interface UseComponentLogicProps {
  initialValue?: boolean;
  onChange?: (value: boolean) => void;
}

export const useComponentLogic = ({
  initialValue = false,
  onChange
}: UseComponentLogicProps = {}) => {
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
export interface AdvancedComponentProps {
  initialActive?: boolean;
  onStateChange?: (active: boolean) => void;
  children: ReactNode;
}

export const AdvancedComponent: FC<AdvancedComponentProps> = ({
  initialActive = false,
  onStateChange,
  children
}) => {
  const { isActive, toggle } = useComponentLogic({
    initialValue: initialActive,
    onChange: onStateChange
  });

  return (
    <button
      type="button"
      className={`advanced-component ${isActive ? 'active' : ''}`}
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
interface CardContextValue {
  variant: 'default' | 'elevated' | 'outlined';
}

const CardContext = createContext<CardContextValue | null>(null);

const useCardContext = () => {
  const context = useContext(CardContext);
  if (!context) {
    throw new Error('Card compound components must be used within a Card');
  }
  return context;
};

export interface CardProps {
  variant?: 'default' | 'elevated' | 'outlined';
  children: ReactNode;
  className?: string;
}

export const Card: FC<CardProps> & {
  Header: FC<CardHeaderProps>;
  Body: FC<CardBodyProps>;
  Footer: FC<CardFooterProps>;
} = ({ variant = 'default', children, className = '' }) => {
  const contextValue = { variant };

  return (
    <CardContext.Provider value={contextValue}>
      <div className={`card card--${variant} ${className}`}>
        {children}
      </div>
    </CardContext.Provider>
  );
};

// Card sub-components
interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

const CardHeader: FC<CardHeaderProps> = ({ children, className = '' }) => {
  const { variant } = useCardContext();

  return (
    <header className={`card__header card__header--${variant} ${className}`}>
      {children}
    </header>
  );
};

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

const CardBody: FC<CardBodyProps> = ({ children, className = '' }) => {
  const { variant } = useCardContext();

  return (
    <div className={`card__body card__body--${variant} ${className}`}>
      {children}
    </div>
  );
};

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

const CardFooter: FC<CardFooterProps> = ({ children, className = '' }) => {
  const { variant } = useCardContext();

  return (
    <footer className={`card__footer card__footer--${variant} ${className}`}>
      {children}
    </footer>
  );
};

// Attach sub-components
Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
```

## Template Checklist

When creating a new component using this template:

✅ **Component Requirements**:

- [ ] Props interface exported
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

✅ **Testing Requirements**:

- [ ] Test file uses 'rc:' prefix
- [ ] All interactive behaviors tested
- [ ] Accessibility attributes tested
- [ ] Edge cases and error states tested
- [ ] Props validation tested

✅ **Storybook Requirements**:

- [ ] Default story with basic props
- [ ] Stories for all variants/sizes
- [ ] Accessibility example story
- [ ] Interactive example with controls
- [ ] Documentation descriptions added

✅ **Performance Considerations**:

- [ ] Memoization added if needed (React.memo, useMemo, useCallback)
- [ ] Event handlers stable between renders
- [ ] No unnecessary re-renders
- [ ] Lazy loading for heavy components
