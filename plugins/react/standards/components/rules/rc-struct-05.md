# RC-STRUCT-05: Barrel Files Re-export Props Types

## Intent

When a barrel file (`index.ts` or `index.tsx`) re-exports a component, it MUST also re-export the component's `Props` type. Consumers who need to type wrapper props, build higher-order components, or write story `args` cannot reach the Props type if the barrel only forwards the runtime export. The type and the component are a single public API surface.

## Fix

- For every `export { <Name> } from './<name>'` in a barrel, add a matching `export type { <Name>Props } from './<name>'`
- OR collapse to the combined form: `export { <Name>, type <Name>Props } from './<name>'`
- OR use `export * from './<name>'` — the wildcard re-export includes both value and type exports
- If the component file genuinely defines no `Props` type (e.g. a zero-prop component), it is exempt — re-export the component alone

```typescript
// ❌ BAD: component re-exported, Props type hidden
export { Button } from './button';

// ✅ GOOD: split value and type re-exports
export { Button } from './button';
export type { ButtonProps } from './button';

// ✅ GOOD: combined re-export with inline `type` modifier
export { Button, type ButtonProps } from './button';

// ✅ GOOD: wildcard re-export covers both
export * from './button';

// ✅ GOOD (exempt): no Props type defined on the component
export { Divider } from './divider';
```

## Code Superpowers

- For every `index.{ts,tsx}` barrel, parse `export { … } from './<name>'` clauses and confirm a matching `export type { <Name>Props … }` exists (or the same statement uses `type <Name>Props`, or the file uses `export *`)
- Cross-reference the source file (`./<name>.tsx`): if it declares `export type <Name>Props`, the barrel MUST re-export it
- Flag mixed barrels where some components forward their Props and others do not — inconsistency is itself a violation

## Common Mistakes

1. Re-exporting only the component (`export { Button } from './button'`) and forgetting the Props type
2. Using `export { Button, ButtonProps }` without the `type` modifier — works at runtime but trips `isolatedModules` / `verbatimModuleSyntax` builds; prefer `export { Button, type ButtonProps }`
3. Re-exporting an internal type that was never meant to be public — only the `<Name>Props` of exported components belongs in the barrel
4. Adding `export *` then shadowing it with a narrower named re-export that drops the Props type

## Edge Cases

- Generated barrels: regenerate with the Props re-export rule baked into the generator; do not hand-edit the output
- Components that intentionally hide their Props (internal-only wrappers): they should not be exported from the barrel at all — the rule only applies when the component itself is re-exported

## Related

RC-STRUCT-02, RC-STRUCT-03, RC-STRUCT-04
