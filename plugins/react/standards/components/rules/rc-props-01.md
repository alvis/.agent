# RC-PROPS-01: Simple, Flat Props

## Intent

Props are flat, simple, and well-typed. Avoid deeply nested config objects that hide the component's API behind opaque shapes.

## Fix

- Flatten nested config props into discrete top-level props
- Use union literal types for variants instead of free-form strings
- If a related cluster of props grows, consider splitting the component instead of nesting props

```typescript
// ✅ GOOD: simple, focused props
export type AlertProps = {
  variant: "success" | "warning" | "error";
  message: string;
  onDismiss?: () => void;
};

// ❌ BAD: complex nested structure
export type BadProps = {
  config: {
    display: { variant: string; theme: object; };
    behavior: { dismissible: boolean; callbacks: object; };
  };
};
```

## Code Superpowers

- Flag Props type aliases where a prop's type is an inline object literal of depth > 1
- Flag any prop typed as `object` or `Record<string, any>`
- Count props per Props type alias; >10 props is a refactor signal

## Common Mistakes

1. Passing a single `config` object to "future-proof" the API
2. Typing variants as `string` instead of union literals
3. Mixing display props and behavior props in the same nested namespace

## Edge Cases

- Form field configs and table column definitions may legitimately be nested arrays of objects

## Related

RC-PROPS-02, RC-STRUCT-02
