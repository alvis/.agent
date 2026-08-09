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
