# TYP-IMPT-02: Separate Code and Type Imports

## Intent

Never mix `type` with runtime imports in one line. Keep a blank line between code imports and type imports.

## Fix

```typescript
// separate code and type imports
import { useState, useEffect } from "react";

import type { FC } from "react";
```

### Multiple Type Imports

```typescript
import { z } from "zod";

import type { ZodSchema } from "zod";
import type { User } from "#user/types";
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `import { x, type T } from "pkg"`, refactor before adding new behavior.
- Even for a single mixed import, split into separate `import` and `import type` statements.

## Related

TYP-IMPT-01, TYP-IMPT-03, TYP-IMPT-04
