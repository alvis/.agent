---
since: "TS 5.0"
min-es-target: "any"
module: "any"
---

## Detection

Manual `"paths"` mappings in tsconfig.json to work around package.json `exports` or `imports` field resolution

## Before

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "node",
    // manual path mappings because "node" resolution ignores package.json exports
    "paths": {
      "@scope/ui/button": ["./node_modules/@scope/ui/dist/components/button"],
      "@scope/ui/theme": ["./node_modules/@scope/ui/dist/theme/index"]
    }
  }
}
```

```jsonc
// node_modules/@scope/ui/package.json
{
  "name": "@scope/ui",
  "exports": {
    "./button": "./dist/components/button.js",
    "./theme": "./dist/theme/index.js"
  }
}
```

## After

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "resolvePackageJsonExports": true,
    "resolvePackageJsonImports": true
    // manual paths mappings no longer needed
  }
}
```

```typescript
// subpath exports resolve correctly
import { Button } from "@scope/ui/button";
import { theme } from "@scope/ui/theme";
```

## Conditions

- Both flags are automatically enabled under `--moduleResolution bundler` and `--moduleResolution nodenext`
- Only needed explicitly when using `--moduleResolution node` with packages that define `"exports"` or `"imports"` fields
- `resolvePackageJsonExports` handles the `"exports"` field (subpath exports from dependencies)
- `resolvePackageJsonImports` handles the `"imports"` field (subpath imports within your own package, typically prefixed with `#`)
