# TYP-IMPT-05: Use Relative Imports Inside Same Subpath

## Intent

Within the same subpath domain/module family (for example `#fastify/*`), use relative imports (`./`, `../`). Do not self-import via that domain alias/subpath from sibling files in the same domain.

## Fix

```typescript
// file: src/fastify/request.ts (part of #fastify/*)
// relative imports within same subpath domain
import { formatResponse } from "./response";
import { errorHandler } from "./error";
```

### Subpath Only for Different Domains

```typescript
// file: src/fastify/request.ts
import { validate } from "#utilities/validator";  // different domain: subpath OK
import { helpers } from "./helpers";               // same domain: relative
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `import { e } from "#fastify/error"` from within `#fastify/*`, refactor before adding new behavior.
- If the import stays inside one alias domain, use relative path; if crossing domains, use alias path (see `TYP-IMPT-04`).

## Related

TYP-IMPT-04, TYP-IMPT-01, TYP-IMPT-02
