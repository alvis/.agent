# DOC-FORM-06: Standard Section Names

## Intent

Use a consistent vocabulary of UPPERCASE section names across data structures and files. Standard names make code scannable without learning project-specific conventions.

## Standard Names

**TypeScript** (interfaces, types, objects):

IDENTIFIERS, PROPERTIES, DISPLAY, FLAGS, TIMESTAMPS, RELATIONS, AUTHENTICATION DETAILS, PERMISSIONS, METADATA, INDEX

**Prisma models:**

IDENTIFIERS, PROPERTIES, FLAGS, TIMESTAMPS, RELATIONS

## Rules

- Names **must** be UPPERCASE
- Names should be descriptive and concise (1–3 words typically)
- Use a **standard name** when it fits; use a **domain-specific name** only when no standard name applies
- Domain-specific names follow the same format: `// --- DOMAIN NAME --- //`

## Fix

```typescript
// ✅ GOOD: standard names
interface User {
  // --- IDENTIFIERS --- //
  id: string;

  // --- AUTHENTICATION DETAILS --- //
  passwordHash: string;
  lastLogin: Date;

  // --- PERMISSIONS --- //
  roles: string[];
}
```

```typescript
// ❌ BAD: non-standard name when a standard one applies
interface User {
  // --- IDS --- //
  id: string;

  // --- LOGIN STUFF --- //
  passwordHash: string;
}
```

```typescript
// ❌ BAD: lowercase section name
interface User {
  // --- identifiers --- //
  id: string;
}
```

## Related

DOC-FORM-01, DOC-FORM-05, DOC-FORM-07
