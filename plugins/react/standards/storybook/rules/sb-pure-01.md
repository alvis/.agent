# SB-PURE-01: No Inline Component Definitions

## Intent

Stories must render existing components from the codebase, not anonymous components defined inside `render`. Inline components mask reuse, prevent type checking, and rot quickly because they aren't covered by the rest of the codebase's tests.

## Fix

- Move any helper component into the regular component tree (`./components/...`) and import it
- If the wrapper is truly story-only, factor it into a named helper inside the story file (still imported, still typed)
- Reserve `render` for composition of *real* components; never for declaring brand new ones

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

## Code Superpowers

- Grep `render: \(\) => \{` and look for nested `const \w+ = \(` component declarations
- Lint with `react/no-multi-comp` scoped to `*.stories.tsx`

## Common Mistakes

1. Throwaway wrapper components defined inline to inject mock context
2. Untyped function components inside `render` — props inferred as `any`
3. Inline definitions duplicating a real component that already exists elsewhere

## Related

SB-PURE-02, SB-STRUCT-01
