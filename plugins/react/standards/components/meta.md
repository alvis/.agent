# React Component Standards

_Standards for React component structure, patterns, and performance optimization_

## Dependent Standards

🚨 **[IMPORTANT]** You MUST also read the following standards together with this file

- TypeScript Standards (plugin:coding:standard:typescript) - React components use TypeScript interfaces and typing throughout all examples
- Function Standards (plugin:coding:standard:function) - React components are functions and component handlers are functions
- Testing Standards (plugin:coding:standard:testing) - Component test files and testing patterns are essential for quality
- Documentation Standards (plugin:coding:standard:documentation) - Components require proper JSDoc and interface documentation
- General Principles (plugin:coding:standard:universal) - Foundational coding principles that apply to all component code
- File Naming Standards (plugin:coding:standard:file-structure) - Specific component file naming patterns (Button.tsx, Button.stories.tsx)
- Accessibility Standards (standard:accessibility) - Frontend components must follow accessibility requirements
- Storybook Standards (standard:storybook) - Component stories document behavior and verify accessibility; this standard enforces story existence per component
- React Project Structure Standards (standard:project-structure) - Component placement and barrel conventions within the project tree

**Note**: This standard requires the coding plugin to be enabled for referenced coding standards.

## Core Principles

### Functional Components with TypeScript

Always use functional components with proper TypeScript interfaces for type safety and maintainability.

```typescript
// ✅ GOOD: exported type alias, inherits element props, wraps children
export type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: 'primary' | 'secondary';
};

export const Button: FC<ButtonProps> = ({ variant = 'primary', ...props }) => {
  return <button className={variant} {...props} />;
};

// ❌ BAD: missing exported Props type, class component
class BadButton extends Component {
  render() { return <button>...</button>; }
}
```

### Single Responsibility

Components still follow the Single Responsibility principle from the general coding standards, but express it with UI intent: move data-fetching or orchestration into hooks/utilities and keep renders focused.

```typescript
// ✅ GOOD: focused component
export const UserProfile: FC<Props> = ({ user }) => {
  return (
    <div>
      <UserAvatar user={user} />
      <UserInfo user={user} />
      ...
    </div>
  );
};

// ❌ BAD: monolithic component handling multiple concerns
export const UserEverything: FC<Props> = ({ user }) => {
  // 200+ lines of mixed logic
};
```

### Performance Optimization

Use memoization strategically for expensive operations and stable references.

```typescript
// ✅ GOOD: memoize expensive calculations
export const ExpensiveList = memo(({ items }: Props) => {
  const sortedItems = useMemo(() => 
    items.sort((a, b) => b.timestamp - a.timestamp), [items]
  );
  
  const handleClick = useCallback((id: string) => {
    updateItem(id);
  }, [updateItem]);
  
  return <div>{sortedItems.map(item => <Item key={item.id} ... />)}</div>;
});

// ❌ BAD: creating objects in render
export const BadComponent = ({ user }) => {
  return (
    <UserProfile
      style={{ margin: 10 }} // new object every render
      options={{ showEmail: true }} // new object every render
    />
  );
};
```

### Documentation

Every exported component ships `<Name>.stories.tsx` (basic states + props matrix). Components participating in multi-component scenarios (composition with siblings, slots, controlled-uncontrolled coordination) additionally ship `<Name>.demo.stories.tsx` showing the integration. See `standard:storybook` for story authoring rules; this principle enforces _coverage_, not _content_.

```typescript
// ✅ GOOD: component ships with its story file
// Button.tsx + Button.stories.tsx

// ✅ GOOD: composition scenario adds a demo story
// Form.tsx + Form.stories.tsx + Form.demo.stories.tsx

// ❌ BAD: exported component with no story file
// Button.tsx (no Button.stories.tsx anywhere)
```

### Accessibility

Components are accessible by default: semantic HTML, `aria-*` attributes, keyboard navigation, focus management. Accessibility is verified in Storybook via interaction tests. See `standard:accessibility` for the full a11y rule set; this principle is a cross-reference reminder for component authors.

```typescript
// ✅ GOOD: semantic + aria + keyboard
<button
  aria-label="Close dialog"
  aria-expanded={isOpen}
  onClick={handleClose}
>
  Close
</button>

// ❌ BAD: clickable div without role, tabIndex, or key handlers
<div onClick={handleClose}>Close</div>
```

## Rule Groups

- `RC-NAMING-*`: File naming conventions and directory structure for components, tests, and stories.
- `RC-STRUCT-*`: Functional component structure with TypeScript type aliases; no class components except Error Boundaries.
  - `RC-STRUCT-01`: Functional Components Only
  - `RC-STRUCT-02`: Exported Props Type Alias (use `export type <Name>Props = …`, not `interface`)
  - `RC-STRUCT-03`: Use `PropsWithChildren` for `children`
  - `RC-STRUCT-04`: Extend Element Props with React Helpers (`ComponentPropsWithoutRef<'tag'>`)
  - `RC-STRUCT-05`: Barrel Files Re-export Props Types
- `RC-PROPS-*`: Props design — exported interfaces, simple/predictable shapes, composition over configuration.
- `RC-STATE-*`: State placement — local-first, lift only when necessary, Context for deep prop drilling.
- `RC-PERF-*`: Performance — memoization with `memo`/`useMemo`/`useCallback`; avoid creating objects in render.
- `RC-NEXT-*`: Framework integration patterns for Next.js (dynamic imports, optimized images).
- `RC-DOC-*`: Storybook coverage per component — `<Name>.stories.tsx` required; `<Name>.demo.stories.tsx` for multi-component scenarios.
