# RC-STRUCT-02: Exported Props Type Alias

## Intent

Every component that accepts props exports a named `type <Name>Props = …` alias
and types itself with `FC<<Name>Props>`. This is the explicit exception to
TypeScript rule `TYP-TYPE-01`: type aliases compose with React helpers
(`PropsWithChildren`, `ComponentPropsWithoutRef<'tag'>`) via intersections,
which `interface` cannot express without contortion. The exception applies to
React component props regardless of visibility. A component that accepts no
props needs no artificial empty alias, consistent with `RC-STRUCT-05`. Inline
anonymous prop types prevent reuse, complicate documentation, and break
type-only re-exports.

## Fix

- Replace inline destructured types with an exported `type` alias
- Convert any `export interface <Name>Props { … }` to `export type <Name>Props = { … }` — this is a mechanical rename (`interface` → `type`) plus inserting `=` after the name
- Name the alias `<ComponentName>Props`
- Type the component as `FC<<ComponentName>Props>`
- Leave a genuinely zero-prop component as `FC` without an empty props alias

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

// ✅ GOOD: zero-prop component needs no artificial alias
export const Divider: FC = () => <hr />;
```

## Code Superpowers

- AST-scan component declarations for inline object-type annotations on the props parameter
- Flag any `FC<{...}>` literal type instead of a named alias
- Grep for `^\s*(export\s+)?interface\s+\w+Props\b` — every match outside a documented BAD code block is a violation
- Confirm each component that accepts props has a matching exported
  `type XProps = …` in the same file; zero-prop components are exempt

## Common Mistakes

1. Inlining props as `({ x, y }: { x: string; y: number })`
2. Declaring the alias but forgetting to `export` it
3. Naming the alias `Props` instead of `<Component>Props` (collides on re-export)
4. Leaving legacy `interface XProps` declarations after migrating — the rename is mechanical, do it now
5. Adding `type DividerProps = Record<string, never>` to a zero-prop component

## Related

RC-STRUCT-01, RC-STRUCT-03, RC-STRUCT-04, RC-STRUCT-05, RC-PROPS-01
