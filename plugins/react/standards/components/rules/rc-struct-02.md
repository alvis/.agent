# RC-STRUCT-02: Exported Props Type Alias

## Intent

Every component exports a named `type <Name>Props = …` alias and types itself with `FC<<Name>Props>`. Type aliases compose with React helpers (`PropsWithChildren`, `ComponentPropsWithoutRef<'tag'>`) via intersections, which `interface` cannot express without contortion. Inline anonymous prop types prevent reuse, complicate documentation, and break type-only re-exports.

## Fix

- Replace inline destructured types with an exported `type` alias
- Convert any `export interface <Name>Props { … }` to `export type <Name>Props = { … }` — this is a mechanical rename (`interface` → `type`) plus inserting `=` after the name
- Name the alias `<ComponentName>Props`
- Type the component as `FC<<ComponentName>Props>`

```typescript
// ❌ BAD: inline props type, not exported
const BadButton = ({ onClick }: { onClick: () => void }) => {
  return <button onClick={onClick}>...</button>;
};

// ❌ BAD: interface declaration (use `type` alias instead — see Intent)
export interface ButtonProps {
  onClick?: () => void;
}

// ✅ GOOD: exported type alias
export type ButtonProps = {
  onClick?: () => void;
};

export const Button: FC<ButtonProps> = ({ onClick }) => {
  return <button onClick={onClick}>...</button>;
};
```

## Code Superpowers

- AST-scan component declarations for inline object-type annotations on the props parameter
- Flag any `FC<{...}>` literal type instead of a named alias
- Grep for `^\s*(export\s+)?interface\s+\w+Props\b` — every match outside a documented BAD code block is a violation
- Confirm each `export const X` has a matching `export type XProps = …` in the same file

## Common Mistakes

1. Inlining props as `({ x, y }: { x: string; y: number })`
2. Declaring the alias but forgetting to `export` it
3. Naming the alias `Props` instead of `<Component>Props` (collides on re-export)
4. Leaving legacy `interface XProps` declarations after migrating — the rename is mechanical, do it now

## Edge Cases

- Trivially small private components inside the same file may use inline types if not re-exported

## Related

RC-STRUCT-01, RC-STRUCT-03, RC-STRUCT-04, RC-STRUCT-05, RC-PROPS-01
