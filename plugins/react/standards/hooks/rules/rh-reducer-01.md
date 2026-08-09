# RH-REDUCER-01: Reducer for Complex Coordinated State

## Intent

Use `useReducer` for state with multiple related fields whose updates are coordinated (forms, wizards, complex dialogs). Multiple parallel `useState`s for related fields lead to inconsistent intermediate states and brittle update logic.

## Fix

- Identify state with 3+ related fields updated together
- Define a discriminated-union `Action` type and a pure reducer
- Replace parallel `useState` calls with a single `useReducer`
- Expose intent-named callbacks (`setValue`, `reset`) that dispatch actions

```typescript
// ✅ GOOD: form state with reducer pattern
interface FormState<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
}

type FormAction<T> =
  | { type: "SET_VALUE"; field: keyof T; value: T[keyof T] }
  | { type: "SET_ERROR"; field: keyof T; error: string }
  | { type: "RESET"; initialValues: T };

function formReducer<T>(state: FormState<T>, action: FormAction<T>): FormState<T> {
  switch (action.type) {
    case "SET_VALUE":
      return {
        ...state,
        values: { ...state.values, [action.field]: action.value },
        errors: { ...state.errors, [action.field]: undefined },
      };
    case "SET_ERROR":
      return {
        ...state,
        errors: { ...state.errors, [action.field]: action.error },
      };
    case "RESET":
      return {
        values: action.initialValues,
        errors: {},
        touched: {},
        isSubmitting: false,
      };
    default:
      return state;
  }
}

export function useForm<T extends Record<string, any>>(initialValues: T) {
  const [state, dispatch] = useReducer(formReducer, {
    values: initialValues,
    errors: {},
    touched: {},
    isSubmitting: false,
  } as FormState<T>);

  const setValue = useCallback((field: keyof T, value: T[keyof T]) => {
    dispatch({ type: "SET_VALUE", field, value });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET", initialValues });
  }, [initialValues]);

  return { ...state, setValue, reset };
}
```

## Code Superpowers

- Flag hooks/components with 4+ `useState` declarations whose values are coordinated
- Verify the reducer is pure (no side effects, no external reads)

## Common Mistakes

1. Mixing side effects into the reducer (must remain pure)
2. Using string-typed actions without a discriminated union (loses TS exhaustiveness)
3. Resetting individual fields with a chain of `setX` calls instead of a `RESET` action

## Edge Cases

- Two or three independent fields are fine with `useState`
- For very complex shared state, consider an external store rather than `useReducer` + Context

## Related

RH-COMPOSE-01, RH-STABLE-01
