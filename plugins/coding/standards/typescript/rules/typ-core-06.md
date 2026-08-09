# TYP-CORE-06: American English Convention

## Intent

Use American spelling in identifiers and documentation in code. This is the TypeScript-specific application of `GEN-CONS-02`.

## Fix

```typescript
// ❌ interface ColourConfig { primaryColour: string; customisable: boolean; }
interface ColorConfig { primaryColor: string; customizable: boolean; }
```

See `GEN-CONS-02` for canonical guidance.

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `interface ColourConfig {}`, refactor before adding new behavior.

## Related

GEN-CONS-02, TYP-CORE-01, TYP-CORE-05
