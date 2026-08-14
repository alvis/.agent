# TYP-IMPT-08: Do Not Import Through `src` or `source`

## Intent

JavaScript and TypeScript imports MUST NOT traverse into a `src` or `source` directory through a parent-relative path. These paths couple callers to a repository layout and bypass the module's configured public boundary. This is a hard violation even when no subpath alias is currently configured.

## Fix

```typescript
// ❌ WRONG: reaches through the source-directory boundary
import { createUser } from "../../../../src/users/create-user";
import { parseConfig } from "../source/config";

// ✅ CORRECT: use the package's configured public subpath
import { createUser } from "#users/create-user";
import { parseConfig } from "#config";
```

## Scope

The advisory scanner checks JavaScript and TypeScript source lines for static, side-effect, dynamic, and re-export imports containing `../src` or `../source`. It intentionally reports potential sites for review rather than parsing the language. A path that stays within the current module domain, such as a sibling helper module, is governed by `TYP-IMPT-04` and `TYP-IMPT-05` instead.

## Edge Cases

- When existing code matches prior violation patterns such as `import { value } from "../../../src/value"`, replace it with the shortest configured public subpath before adding new behavior.
- If no public subpath exists, define the module boundary before importing through `src` or `source`; do not add an exception for a convenient relative path.

## Related

TYP-IMPT-01, TYP-IMPT-04, TYP-IMPT-05, TYP-IMPT-07
