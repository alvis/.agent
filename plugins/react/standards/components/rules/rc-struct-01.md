# RC-STRUCT-01: Functional Components Only

## Intent

Always use functional components (typed with `FC<Props>`). Class components are forbidden except where React itself requires them (Error Boundaries).

## Fix

- Convert any `class X extends Component` to `export const X: FC<Props> = (props) => { ... }`
- Move lifecycle methods into `useEffect` and instance state into `useState`/`useReducer`
- Keep class components only for React Error Boundaries (`componentDidCatch` / `getDerivedStateFromError`)

```typescript
// ❌ BAD: class component
class BadButton extends Component {
  render() { return <button>...</button>; }
}

// ✅ GOOD: functional component
export const Button: FC<Props> = ({ children }) => {
  return <button>{children}</button>;
};
```

## Code Superpowers

- Grep for `extends Component` / `extends React.Component` and confirm each match is a documented Error Boundary
- Flag `class` declarations inside `components/` or `app/` that are not Error Boundaries

## Common Mistakes

1. Porting legacy class components verbatim instead of refactoring to hooks
2. Using class for "encapsulation" when a custom hook would do
3. Mixing class and functional patterns in the same file

## Edge Cases

- React Error Boundaries still require class syntax — these are exempt
- Library wrappers around third-party class APIs may keep a thin class shell

## Related

RC-STRUCT-02, RC-STATE-01
