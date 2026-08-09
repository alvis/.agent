# RC-STATE-01: Local-First State Placement

## Intent

Keep state close to where it's used. Lift state up only when two or more components must share it. Premature lifting bloats parents and creates re-render cascades.

## Fix

- Default to `useState` inside the component that owns the interaction
- Only lift state when a sibling needs to read or write the same value
- When state belongs to a single subtree but several leaves, consider a small local Context instead of lifting to the page root

```typescript
// ✅ GOOD: local state for local concerns
export const TodoItem: FC<Props> = ({ todo, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div>
      {isEditing ? <TodoEditForm ... /> : <TodoDisplay ... />}
    </div>
  );
};
```

## Code Superpowers

- Trace each piece of state in a parent and confirm ≥ 2 children read it; if only one does, push it down
- Flag `useState` declarations in page-level components whose value is only consumed in a single deeply nested child

## Common Mistakes

1. Lifting state for "consistency" when only one child uses it
2. Putting transient UI state (open/closed) in global stores
3. Threading both setter and value through many intermediate components

## Edge Cases

- Form-wide validation state legitimately lives at the form root
- Wizard/stepper state belongs to the orchestrating parent

## Related

RC-STATE-02, RC-PERF-01
