# TYP-IMPT-04: Use Subpath for Cross-Module Imports

## Intent

When package subpath mapping exists, cross-module imports MUST use the shortest subpath alias. Do not use brittle relative traversal (`../..`) when a stable alias exists.

## Fix

```typescript
// subpath imports for cross-module references
import { handler } from "#request";
import { helper } from "#utilities/validator";
import { errorHandler } from "#fastify/error";
```

### Subpath to Different Domain, Relative Within Same Domain

```typescript
import { validate } from "#utilities/validator";   // cross-module: use subpath
import { formatResponse } from "./response";        // same subpath: use relative (see TYP-IMPT-05)
```

### Import Path Decision

- **Is there a subpath defined in `package.json` for this file?**
  - YES: Continue to next decision
  - NO: Use relative import

- **Are both files in the same subpath?**
  - YES: Use relative import (`TYP-IMPT-05`)
  - NO: Use subpath import from `package.json`

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `import { h } from "../fastify/request"`, refactor before adding new behavior.
- If source and target are in different alias domains, use subpath alias; if same local domain, prefer relative paths per `TYP-IMPT-05`.
- Check `package.json` `imports`/`exports` for the shortest available subpath.

## Related

TYP-IMPT-01, TYP-IMPT-05, TYP-IMPT-03
