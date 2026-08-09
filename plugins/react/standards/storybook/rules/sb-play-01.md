# SB-PLAY-01: Interactive Stories with Play Functions

## Intent

Use `play` functions to script user interactions — clicks, typing, form submission — so stories double as interaction tests and document component behavior under real user input.

## Fix

- Import `within`, `userEvent` from `@storybook/testing-library`
- Inside `play`, scope queries to `within(canvasElement)`
- Use semantic queries (`getByRole`, `getByLabelText`) so stories also validate accessibility
- Await every interaction so test runners observe each step

```typescript
// ✅ GOOD: interactive story with play function
export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await userEvent.click(button);
    ...
  },
};

// ✅ GOOD: form interaction story
export const FormInteraction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Email');
    await userEvent.type(input, 'test@example.com');
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }));
  },
};
```

## Code Superpowers

- Audit components with multi-step flows for at least one `play` story
- Lint for missing `await` inside `play` (race-condition smell)
- Ensure interaction stories use semantic queries, not test ids

## Common Mistakes

1. Using non-semantic queries (`getByTestId`) inside `play`
2. Forgetting `await` on `userEvent` calls
3. No assertions / observable side effects to verify the interaction worked

## Related

SB-COVERAGE-01
