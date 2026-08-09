# RC-DOC-01: Per-Component Storybook Coverage

## Intent

Every exported component must have a `<Name>.stories.tsx` documenting its basic states and props matrix. Components used in multi-component scenarios must additionally have `<Name>.demo.stories.tsx` showing the integration. Storybook coverage makes component behavior reviewable, regression-detectable, and onboarding-friendly. This rule enforces _existence_; `standard:storybook` governs _quality_ (titles, args, autodocs, variant coverage, play functions).

## Fix

- Create the missing story file alongside the component.
- For `.stories.tsx`: default export with `title`, `component`, `tags: ['autodocs']`; named exports for each state (default, disabled, loading, error, key props matrix).
- For `.demo.stories.tsx`: render the multi-component scenario the production code actually uses (siblings, slots, controlled-uncontrolled coordination, form-with-validation flow).
- If a multi-component scenario currently lives inside `<Name>.stories.tsx`, move it into `<Name>.demo.stories.tsx`.

```typescript
// components/Button.stories.tsx — basic single-component coverage
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: 'primary', children: 'Save' } };
export const Disabled: Story = { args: { disabled: true, children: 'Save' } };
```

```typescript
// components/Form.demo.stories.tsx — multi-component scenario
import type { Meta, StoryObj } from '@storybook/react';
import { Form } from './Form';
import { TextField } from '../TextField';
import { SubmitButton } from '../SubmitButton';

const meta = {
  title: 'Components/Form/Demo',
  component: Form,
  tags: ['autodocs'],
} satisfies Meta<typeof Form>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithValidation: Story = {
  render: () => (
    <Form onSubmit={() => {}}>
      <TextField name="email" required />
      <SubmitButton>Send</SubmitButton>
    </Form>
  ),
};
```

## Code Superpowers

- Walk `components/` and flag every `<Name>.tsx` (excluding `index.tsx`) that lacks a sibling `<Name>.stories.tsx`.
- Detect production code that renders multiple components from the same module (composition, slots, controlled-uncontrolled pairs) and assert a sibling `<Name>.demo.stories.tsx` exists.
- Visual regression catch-net: each story is a snapshot target for Chromatic/Percy.
- Onboarding: new contributors read stories to learn the component API before touching code.
- Refactor safety: a missing state in stories is a missing test — coverage gaps surface in review.
- Design-engineering handoff: stories become the spec designers reference and QA against.

## Common Mistakes

1. Exporting a component but skipping its story because "it's just a small wrapper" — every exported surface is part of the public API and must be documented.
2. Placing a multi-component scenario inside `.stories.tsx` instead of `.demo.stories.tsx` — readers expect basic stories to render the component in isolation.
3. Duplicating story content from sibling components inside a demo file instead of demonstrating their composition.
4. Treating `.demo.stories.tsx` as optional when the production code clearly composes multiple components.

## Edge Cases

- Internal-only components (not exported from `index.tsx` and used only inside their origin file): story is optional. The moment the component is reused beyond its origin file, a `<Name>.stories.tsx` becomes required.
- HOCs and render-prop components: story renders a minimal consumer. If the consumer requires sibling components to make sense, file it as `<Name>.demo.stories.tsx`.
- Server Components: the story renders the client-boundary wrapper (`'use client'` child) and documents the server-prop contract in an MDX comment or `parameters.docs.description`.
- Error boundaries: story renders a deliberately-failing child to exercise the fallback render path.
- Generated/codegen components: story is still required if the component is exported from a public barrel; mark generated source clearly to avoid edits being overwritten.

## Related

- `standard:storybook` — story content quality (titles, args, autodocs, variant coverage, play functions).
- `standard:accessibility` — accessibility is verified in stories (interaction tests, axe checks).
- `RC-NAMING-01` — file naming for components, tests, and stories.
