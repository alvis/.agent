# GEN-CONS-02: American English Spelling

## Intent

Use American English spelling in symbols, filenames, and comments. British spelling variants in identifiers, strings, and documentation are non-compliant.

## Fix

```typescript
// ✅ GOOD: American English
interface ColorConfig {
  primaryColor: string;
  customizable: boolean;
}

// ❌ BAD: British English
interface ColourConfig {
  primaryColour: string;
  customisable: boolean;
}
```

## Common British-to-American Replacements

| British          | American        |
|------------------|-----------------|
| `colour`         | `color`         |
| `favourite`      | `favorite`      |
| `organisation`   | `organization`  |
| `customise`      | `customize`     |
| `analyse`        | `analyze`       |
| `behaviour`      | `behavior`      |
| `licence`        | `license`       |
| `centre`         | `center`        |
| `catalogue`      | `catalog`       |
| `normalise`      | `normalize`     |

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `const colour = "red"`, refactor before adding new behavior.
- External API field names from third-party services may use British spelling; wrap them with American-spelled internal names.

## Related

GEN-CONS-01, GEN-CONS-03, TYP-CORE-06
