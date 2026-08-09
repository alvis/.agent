# RC-NAMING-01: Component File Naming

## Intent

Component files use `PascalCase.tsx` (e.g., `Button.tsx`). Every exported component requires a co-located `<Name>.stories.tsx` documenting its states and interactions (with `play()` for interaction tests; see `RC-DOC-01`). Component unit tests live in stories — no `.spec.tsx` for components.

## Fix

- Rename component files from lowercase or kebab-case to PascalCase: `browser.tsx` → `Browser.tsx`
- Place stories next to the component: `Button.tsx` + `Button.stories.tsx` (required for every exported component)
- Migrate any existing `<Name>.spec.tsx` interaction coverage into `<Name>.stories.tsx` via `play()`; delete the `.spec.tsx`

## Code Superpowers

- Walk `components/` and flag any `.tsx` whose basename does not start with an uppercase letter (excluding `index.tsx`)
- Verify each exported `<Name>.tsx` has a sibling `<Name>.stories.tsx`
- Flag any `<Name>.spec.tsx` co-located with a component — interaction coverage belongs in `.stories.tsx`

## Common Mistakes

1. Lowercase component files: `browser.tsx` instead of `Browser.tsx`
2. Missing `<Name>.stories.tsx` for an exported component
3. Using `<Name>.spec.tsx` for component tests — interaction coverage belongs in `.stories.tsx` `play()` (see `RC-DOC-01`)

## Edge Cases

- `index.tsx` re-export barrels are allowed
- Generated files from codegen tools may use other casing if isolated

## Related

RC-STRUCT-01, RC-STRUCT-02, RC-DOC-01, RH-NAMING-01
