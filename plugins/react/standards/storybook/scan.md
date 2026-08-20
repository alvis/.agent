# Storybook: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies and rule groups.

Any single P0 violation blocks approval by default.
If a violation is detected, load the matching rule guide at `./rules/<rule-id>.md` to confirm the violation and follow its fix guidance.

## Quick Scan

### File Naming

- DO NOT use lowercase, missing `.stories` suffix, or non-TS extensions for story files (`button.stories.js`, `ButtonStories.tsx`) [`SB-NAME-01`]

### Title Organization

- DO NOT use flat story titles (`title: 'Button'`) — titles must mirror the file path (`Components/Forms/Button`) [`SB-ORG-01`]

### Story Coverage

- DO NOT ship a single `Default` story when the component has multiple variants/states — cover primary, secondary, disabled, loading, and edge cases [`SB-COVERAGE-01`]

### Story Structure

- DO NOT export an inline or asserted meta object — declare `const meta = { ... } satisfies Meta<typeof Component>`, export it as default, derive `StoryObj<typeof meta>`, and include `tags: ['autodocs']` for component stories [`SB-STRUCT-01`]

### Interactive Stories

- DO NOT import `within` or `userEvent` from another package — use `@storybook/testing-library` [`SB-PLAY-01`]
- DO NOT leave `userEvent` calls unawaited or omit an assertion of observable behavior from a `play` function [`SB-PLAY-01`]

### Controls

- DO NOT omit `argTypes` for configurable props: give enum, boolean, number, and color props suitable controls; disable function and complex-object controls explicitly; document each prop and the component [`SB-CONTROLS-01`]

### Pure Stories

- DO NOT define components inline inside `render` — use existing components imported from the codebase [`SB-PURE-01`]
- DO NOT make real API calls (`fetch`, hooks calling APIs) inside stories — supply mock data via `args` [`SB-PURE-02`]

## Anti-Patterns

### Inline Component Definitions

```typescript
// ❌ BAD: defining components in stories
export const BadStory: Story = {
  render: () => {
    const InlineComponent = ({ text }) => <div>{text}</div>;
    return <InlineComponent text="Bad practice" />;
  },
};

// ✅ GOOD: use existing components
export const GoodStory: Story = {
  render: () => <ExistingComponent text="Good practice" />,
};
```

### Real API Calls in Stories

```typescript
// ❌ BAD: real API calls in stories
export const BadData: Story = {
  render: () => {
    const [data, setData] = useState(null);
    useEffect(() => {
      fetch('/api/data').then(setData); // Real API call
    }, []);
    return <Component data={data} />;
  },
};

// ✅ GOOD: mock data in stories
export const GoodData: Story = {
  args: {
    data: mockData, // Predefined mock data
  },
};
```

### Common Mistakes to Avoid

1. **Missing story variants**
   - Problem: Incomplete documentation of component capabilities
   - Solution: Include all states (default, disabled, loading, error)
   - Example: Create separate stories for each variant

2. **Poor story organization**
   - Problem: Stories scattered without logical grouping
   - Solution: Use path-based titles that mirror file structure

## Rule Matrix

| Rule ID | Violation | Bad Examples |
|---|---|---|
| `SB-STRUCT-01` | Meta is not declared with the canonical `satisfies` typing, or component stories omit autodocs/derived story typing | `export default { component: Button } as Meta<typeof Button>`; `type Story = StoryObj<typeof Button>` |
| `SB-PLAY-01` | Play helpers use the wrong package, interactions are not awaited, or the result is not asserted | `import { userEvent } from '@storybook/test'`; `userEvent.click(button)`; a play function with no `expect(...)` |
| `SB-CONTROLS-01` | A configurable prop lacks a suitable documented control, or a function/complex value exposes an unusable control | Enum prop without `options`; `onClick` without `control: false` |

## Quick Reference

| Story Type | File Name | Title Pattern | Use Case |
|------------|-----------|---------------|----------|
| Component | `Button.stories.tsx` | `Components/UI/Button` | Basic component docs |
| Demo | `Flow.demo.stories.tsx` | `Demos/Feature/Flow` | Multi-component scenarios |
| Interactive | Any story file | N/A | User interaction testing |
| Controls | Any story file | N/A | Prop exploration |

| Control Type | Use Case | Example |
|--------------|----------|---------|
| `select` | Dropdown options | `options: ['sm', 'md', 'lg']` |
| `boolean` | Toggle switch | `control: 'boolean'` |
| `range` | Number slider | `{ min: 0, max: 100 }` |
| `color` | Color picker | `control: 'color'` |
| `false` | Disable control | Functions, complex objects |

## Quick Decision Tree

1. **What type of story is needed?**
   - If single component → Use `Component.stories.tsx`
   - If multi-component scenario → Use `Flow.demo.stories.tsx`
   - If interaction testing → Add `play` functions

2. **How complex is the component?**
   - If simple → Include all variants in one file
   - If complex → Consider separate demo stories
   - If many states → Use comprehensive argTypes

3. **Does it need context?**
   - If providers needed → Use decorators
   - If mock data → Define in story args
   - If interactions → Use play functions
