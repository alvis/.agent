# SB-PURE-02: No Real API Calls in Stories

## Intent

Stories must be deterministic and runnable in any environment. Real `fetch` calls (or hooks that wrap them) make stories flaky, leak credentials, and break Chromatic / interaction tests.

## Fix

- Pass mock data through `args` instead of fetching it
- For hook-driven components, mock the hook via Storybook decorators or MSW
- If a story genuinely needs network behavior, use MSW handlers configured at the project level — never inline `fetch`

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

## Code Superpowers

- Grep `*.stories.tsx` for `fetch(`, `axios.`, or any API client import
- Confirm MSW (or equivalent) is the only network layer reachable from a story

## Common Mistakes

1. `useEffect` + `fetch` inline inside a story `render`
2. Importing the production API client and calling it from the story
3. Mock data defined in the story file but the component still calls a real hook in parallel

## Related

SB-PURE-01, SB-COVERAGE-01
