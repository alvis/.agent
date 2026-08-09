# SB-NAME-01: File Naming Convention

## Intent

Use consistent TypeScript naming for all story files so they're discoverable, type-checked, and follow a single project convention.

## Fix

- Name story files `<ComponentName>.stories.tsx` in PascalCase, matching the component
- Use the `.stories` suffix with dot notation (not dash, not embedded in the basename)
- Use `.tsx` (TypeScript), never `.js`
- Reserve `.demo.stories.tsx` for complex multi-component scenarios

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

## Code Superpowers

- `find . -name '*stories*'` and confirm every match uses the canonical pattern
- ESLint / file-name lint rules to enforce PascalCase + `.stories.tsx`

## Common Mistakes

1. Lowercase filename (`button.stories.tsx`) breaking PascalCase convention
2. Using `.js` instead of `.tsx`, losing type safety on `Meta` / `StoryObj`
3. Dropping `.stories` suffix, hiding the file from Storybook globs

## Related

SB-ORG-01, SB-STRUCT-01
