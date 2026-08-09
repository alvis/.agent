# TYP-IMPT-03: No Namespace Imports

## Intent

`import * as` is forbidden for normal modules. Use named imports unless a dependency only exposes default.

## Fix

```typescript
// named imports instead of namespace imports
import { useEffect, useState } from "react";
import { readFile, writeFile } from "node:fs/promises";
```

### Multiple Named Imports

```typescript
import { z, ZodError } from "zod";
import { describe, expect, it } from "vitest";
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `import * as React from "react"`, refactor before adding new behavior.
- If a package only exposes a default export and no named exports, a default import is acceptable (see `TYP-IMPT-06`).

## Related

TYP-IMPT-01, TYP-IMPT-02, TYP-IMPT-06
