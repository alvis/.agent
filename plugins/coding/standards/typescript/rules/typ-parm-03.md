# TYP-PARM-03: Property Ordering Contract

## Intent

Object contract ordering is mandatory: required fields first, optional fields second, callback/function fields last. Apply the same order consistently across interfaces/types and related constructor/options contracts.

## Fix

```typescript
// property ordering: identity -> primary -> optional -> hooks -> metadata
interface SetUserInput {
  // identity //
  id: string;
  email: string;

  // primary //
  name: string;
  roles: string[];

  // optional //
  isActive?: boolean;

  // hooks //
  onSuccess?: () => void;

  // metadata //
  createdAt: Date;
}
```

### Ordering Categories

1. **Required identity fields** (e.g., `id`, `file`, `name`)
2. **Primary functional arguments** (e.g., `content`, `source`)
3. **Optional modifiers/flags** (e.g., `isDraft`, `overwrite`, `sortOrder`)
4. **Callbacks or hooks** (e.g., `onSuccess`, `onError`)
5. **Misc config or metadata** (e.g., `context`, `traceId`)

### Same Ordering in Function Option Types

```typescript
interface ExportOptions {
  // identity //
  format: "csv" | "json";

  // primary //
  columns: string[];

  // optional //
  includeHeaders?: boolean;
  maxRows?: number;

  // hooks //
  onProgress?: (percent: number) => void;
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `type X = { meta: string; id: string }` (metadata before identity), refactor before adding new behavior.
- Required fields before optional fields within each category group.

## Related

TYP-PARM-01, TYP-PARM-02, TYP-TYPE-01
