# Storybook Standards

_Standards for Storybook stories, organization, and documentation patterns_

## Dependent Standards

🚨 **[IMPORTANT]** You MUST also read the following standards together with this file

- React Components Standards (standard:components) - Storybook documents React components and requires understanding component implementation patterns
- Documentation Standards (plugin:coding:standard:documentation) - Storybook stories serve as living documentation and must follow documentation principles
- TypeScript Standards (plugin:coding:standard:typescript) - All story examples use TypeScript patterns and type definitions
- General Principles (plugin:coding:standard:universal) - Story code must follow foundational coding principles and best practices

**Note**: This standard requires the coding plugin to be enabled for referenced coding standards.

## Core Principles

### File Naming Convention

Use consistent TypeScript naming for all story files.

```plaintext
✅ GOOD: descriptive TypeScript story files
Button.stories.tsx
UserCard.stories.tsx
PaymentFlow.demo.stories.tsx    # Complex scenarios

❌ BAD: inconsistent naming
button.stories.js               # Should be PascalCase + TS
Button-stories.tsx              # Should use dot notation
ButtonStories.tsx               # Missing .stories suffix
```

### Path-Based Organization

Story titles must reflect component file structure for clear navigation.

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

### Complete Story Coverage

Include all component states and variants for comprehensive documentation.

```typescript
// ✅ GOOD: covers all important states
export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Disabled: Story = { args: { disabled: true } };
export const Loading: Story = { args: { loading: true } };
export const WithLongText: Story = { args: { children: 'Very long button text...' } };

// ❌ BAD: only basic state
export const Default: Story = {};
```

## Rule Groups

- `SB-NAME-*`: File naming — PascalCase with `.stories.tsx`, optional `.demo.stories.tsx` for complex scenarios.
- `SB-ORG-*`: Title organization — path-based titles mirroring file location, directory alignment.
- `SB-COVERAGE-*`: Story coverage — all variants and states (default, disabled, loading, error, edge cases).
- `SB-STRUCT-*`: Story structure — `Meta` / `StoryObj` typing, `tags: ['autodocs']`, demo stories for multi-component scenarios.
- `SB-PLAY-*`: Interactive stories — `play` functions for user interaction testing.
- `SB-CONTROLS-*`: Controls and argTypes — comprehensive `argTypes` with descriptions, disabled controls for functions.
- `SB-PURE-*`: Pure stories — no inline component definitions, no real API calls; use existing components and mock data.
