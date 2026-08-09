# TST-MOCK-14: Use Instance Types for Class Mock Typing

## Intent

Do not use module type `typeof import("...")` for class instance mock typing. Use `InstanceType<typeof import("...")["ClassName"]>` or import the class type directly.

## Fix

```typescript
// Before: Using module type for class instance
const encoder = {} satisfies Partial<typeof import("#encoder")>;

// After: Using InstanceType
const encoder = {} satisfies Partial<InstanceType<typeof import("#encoder")["Encoder"]>>;
```

## Edge Cases

- When existing code matches prior violation patterns such as `Partial<typeof import("#svc")>`, refactor before adding new behavior.

## Related

TST-MOCK-01, TST-MOCK-02, TST-MOCK-03
