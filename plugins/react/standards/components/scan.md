# React Components: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies and rule groups.

Any single violation blocks approval by default.
If a violation is detected, load the matching rule guide at `./rules/<rule-id>.md` to confirm the violation and follow its fix guidance.

## Quick Scan

### File Naming & Structure

- DO NOT name component files in lowercase or kebab-case — use `PascalCase.tsx` (e.g., `Button.tsx`, not `browser.tsx`) [`RC-NAMING-01`]
- DO NOT co-locate `<Name>.spec.tsx` with a component — interaction coverage belongs in `<Name>.stories.tsx` `play()` [`RC-NAMING-01`]

### Component Structure

- DO NOT use class components except for Error Boundaries — use functional components with `FC<Props>` [`RC-STRUCT-01`]
- DO NOT inline anonymous prop types or use `interface` for Props — export a type alias (`export type ButtonProps = …`) and type the component with it [`RC-STRUCT-02`]
- DO NOT hand-roll `children: ReactNode` in a Props block — wrap with `PropsWithChildren<…>` instead [`RC-STRUCT-03`]
- DO NOT hand-roll native HTML attribute props (`href`, `onClick`, `target`, `disabled`) on a wrapper component — extend `ComponentPropsWithoutRef<'tag'>` [`RC-STRUCT-04`]
- DO NOT re-export a component from a barrel without also re-exporting its `<Name>Props` type [`RC-STRUCT-05`]

### Props Design

- DO NOT design deeply nested config object props (`config.display.variant`) — keep props flat, simple, and focused [`RC-PROPS-01`]
- DO NOT pile on prop flags to configure variants (`showHeader`, `headerStyle`) when composition (`<Card.Header>`) expresses intent better [`RC-PROPS-02`]

### State Management

- DO NOT lift state to a parent when only one child uses it — keep state local to where it's used [`RC-STATE-01`]
- DO NOT prop-drill the same value through 3+ levels — use Context for deep nesting [`RC-STATE-02`]

### Performance

- DO NOT create object/array literals inline in JSX (`style={{ margin: 10 }}`) — define outside or memoize [`RC-PERF-01`]
- DO NOT skip `useMemo` for genuinely expensive calculations or `useCallback` for handlers passed to memoized children [`RC-PERF-02`]

### Framework Integration

- DO NOT statically import heavy/optional components — use `dynamic(() => import(...))` with a loading fallback [`RC-NEXT-01`]
- DO NOT use raw `<img>` for content images in Next.js — use `next/image` with width/height/alt [`RC-NEXT-01`]

### Documentation

- DO NOT export a component without a corresponding `<Name>.stories.tsx` file [`RC-DOC-01`]
- DO NOT compose multiple components in production without a `<Name>.demo.stories.tsx` demonstrating the scenario [`RC-DOC-01`]

## Rule Matrix

| Rule ID | Violation | Bad Examples |
|---|---|---|
| `RC-NAMING-01` | Wrong component file casing, or `<Name>.spec.tsx` co-located with a component | `browser.tsx` (should be `Browser.tsx`); `Button.spec.tsx` next to `Button.tsx` (move interaction coverage into `Button.stories.tsx` `play()`) |
| `RC-STRUCT-01` | Class component used | `class BadButton extends Component { render() { ... } }` |
| `RC-STRUCT-02` | Inline/non-exported props type, or `interface .*Props` declaration | `const BadButton = ({ onClick }: { onClick: () => void }) => ...`; `export interface ButtonProps { … }` |
| `RC-STRUCT-03` | Inline `children: ReactNode` inside a Props block instead of `PropsWithChildren<…>` | `export type CardProps = { children: ReactNode; variant?: 'a' }` |
| `RC-STRUCT-04` | Hand-rolled HTML-attribute Props without `ComponentPropsWithoutRef`/`ComponentPropsWithRef` (also flags lingering `HTMLAttributes`/`AnchorHTMLAttributes`/`ButtonHTMLAttributes` imports in component files) | `export type LinkProps = { href: string; target?: string; onClick?: … }` |
| `RC-STRUCT-05` | Barrel re-exports `<Name>` but not `<Name>Props` (and the component file declares `<Name>Props`) | `export { Button } from './button'` with no matching `export type { ButtonProps }` |
| `RC-PROPS-01` | Deeply nested config-object props | `config: { display: { variant }, behavior: { dismissible } }` |
| `RC-PROPS-02` | Prop explosion instead of composition | `<UserCard title="" showHeader headerStyle="primary" user={user} />` |
| `RC-STATE-01` | State lifted unnecessarily / placed too far from use | Top-level state used by only one leaf component |
| `RC-STATE-02` | Deep prop drilling | Same `user` prop threaded through 4 components instead of Context |
| `RC-PERF-01` | Object/array created inline in render | `style={{ margin: 10 }}`; `options={{ showEmail: true }}` in JSX |
| `RC-PERF-02` | Missing memoization on hot paths | Expensive sort each render; new handler each render passed to memoized child |
| `RC-NEXT-01` | Heavy import without `dynamic`; raw `<img>` instead of `next/image` | `import HeavyChart from '#components/Chart'`; `<img src="/hero.jpg">` |
| `RC-DOC-01` | Missing per-component Storybook coverage | Exported `Button.tsx` without `Button.stories.tsx`; composed `<Form><Field/></Form>` without `Form.demo.stories.tsx` |
