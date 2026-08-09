# TYP-IMPT-06: Prefer Named Imports

## Intent

Use named imports by default. Default imports are allowed only when the dependency does not expose named exports for the symbol.

## Fix

```typescript
// named imports preferred
import { useState } from "react";
import { readFile } from "node:fs/promises";
```

### Default Import Acceptable When Package Only Exports Default

```typescript
import chalk from "chalk";
```

### Barrel Re-Exports Use Named Exports

```typescript
// index.ts - barrel export file
export { UserService } from "./user-service";
export { UserRepository } from "./user-repository";

export type { User, CreateUser } from "./types";
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `import React from "react"`, refactor before adding new behavior.
- Check whether the package exposes named exports before falling back to default import.

## Related

TYP-IMPT-01, TYP-IMPT-02, TYP-IMPT-03
