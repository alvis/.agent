# DOC-FORM-07: Section Ordering

## Intent

Maintain a predictable section order so readers always know where to find identifiers (top) and relations/indexes (bottom). Middle sections follow a logical flow from core properties to metadata.

## Ordering Rules

1. **IDENTIFIERS** always comes first when present
2. Middle sections follow a logical flow: PROPERTIES → DISPLAY → FLAGS → TIMESTAMPS → AUTHENTICATION DETAILS → PERMISSIONS → METADATA
3. **RELATIONS** and **INDEX** always come last when present
4. Empty groups are **omitted entirely** — never leave an empty section divider
5. Ordering within a section follows existing code conventions (alphabetical, by importance, etc.)

## Fix

```typescript
// ✅ GOOD: correct ordering
interface User {
  // --- IDENTIFIERS --- //
  id: string;

  // --- PROPERTIES --- //
  name: string;
  email: string;

  // --- FLAGS --- //
  isActive: boolean;

  // --- TIMESTAMPS --- //
  createdAt: Date;
  updatedAt: Date;

  // --- RELATIONS --- //
  posts: Post[];
}
```

```typescript
// ❌ BAD: IDENTIFIERS not first, RELATIONS not last
interface User {
  // --- PROPERTIES --- //
  name: string;

  // --- IDENTIFIERS --- //
  id: string;

  // --- RELATIONS --- //
  posts: Post[];

  // --- TIMESTAMPS --- //
  createdAt: Date;
}
```

```typescript
// ❌ BAD: empty section divider
interface User {
  // --- IDENTIFIERS --- //
  id: string;

  // --- FLAGS --- //

  // --- TIMESTAMPS --- //
  createdAt: Date;
}
```

## Related

DOC-FORM-01, DOC-FORM-05, DOC-FORM-06
