# SB-COVERAGE-01: Complete Story Coverage

## Intent

Include all component states and variants for comprehensive documentation. A single `Default` story misrepresents the component as having one state and leaves variants undocumented for designers, QA, and visual regression.

## Fix

- Export one story per primary state: `Primary`, `Secondary`, `Disabled`, `Loading`
- Add edge-case stories such as `WithLongText`, `Empty`, `Error`
- For boolean / enum props, include a story per realistic value combination

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

## Code Superpowers

- Lint each `*.stories.tsx` for export count vs. component prop variants
- Cross-check against component prop union types — every literal should appear in at least one story

## Common Mistakes

1. Single `Default` story for components with several variants
2. Missing `Disabled` / `Loading` / `Error` states
3. No edge-case stories (long text, empty data, RTL) for layout-sensitive components

## Related

SB-STRUCT-01, SB-CONTROLS-01
