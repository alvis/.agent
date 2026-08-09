# TST-MOCK-06: Keep Mocks Lean and Real-Type Based

## Intent

Do not create custom mock-only interfaces or oversized mock surfaces with unused methods.

## Fix

```typescript
const logger = { info: vi.fn() } satisfies Partial<Logger>;
```

## Edge Cases

When existing code matches prior violation patterns such as `interface MockRepo { get():void }`, refactor before adding new behavior.

## Related

TST-MOCK-01, TST-MOCK-02, TST-MOCK-03
