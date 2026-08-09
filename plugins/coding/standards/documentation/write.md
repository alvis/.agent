# Documentation: Compliant Code Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.
> **Compliance**: Also follow `scan.md` in this directory to avoid violations during writing. When unsure about a specific rule, consult its detailed guidance in `rules/<rule-id>.md`.

## Key Principles

- Comments explain intent, constraints, or rationale -- never restate what code already says
- Use lowercase sentence style for all explanatory comments and JSDoc summaries
- Function JSDoc summaries start with a present-tense third-person verb (`validates`, `returns`, `creates`)
- One-line JSDoc only for no-param void-return functions; multi-line for everything else
- Temporary and review tags must never be committed
- Update or remove related comments/JSDoc when behavior changes
- Document exported APIs and complex types where contract is not self-evident

## Core Rules Summary

### Content Quality (DOC-CONT)

- **DOC-CONT-01**: Comments explain why, not what -- remove anything that mirrors code syntax or names.
- **DOC-CONT-02**: Inline comments must add value by explaining decisions or edge-case behavior.
- **DOC-CONT-03**: No author/date stamps, modified-by history, temporary tags, or dead commented-out code.
- **DOC-CONT-04**: Document exported APIs, interfaces, and complex types where behavior/contract is not self-evident.
- **DOC-CONT-05**: Source-code comments must not name standard rule IDs (`DOC-FORM-03`, `TYP-IMPT-07`) or group prefixes (`TST-STRU`). Comments explain intent in their own terms; rule IDs belong in standards files and lint reports.

### Formatting (DOC-FORM)

- **DOC-FORM-01**: Write explanatory comments and JSDoc summaries in lowercase sentence style; uppercase only for section headers (`// --- NAME --- //`) and code/type/acronym references.
- **DOC-FORM-02**: One-line JSDoc for no-param void functions; multi-line when parameters, non-void returns, `@throws`, or examples exist.
- **DOC-FORM-03**: All JSDoc prose (function summary, `@returns`, `@throws`, `@example` description, free `* …` lines) stays lowercase and omits a trailing period; function summaries additionally use a present-tense third-person verb. Exception: first word may be uppercase when it is a code/type/acronym reference.
- **DOC-FORM-04**: `@param` descriptions start lowercase, describe semantics not TypeScript types; capitalize only for proper type/interface/acronym references.
- **DOC-FORM-05**: Use section dividers (`// --- NAME --- //`) in structures with 3+ logical groups; skip for trivial structures.
- **DOC-FORM-06**: Use standard UPPERCASE section names (IDENTIFIERS, PROPERTIES, FLAGS, TIMESTAMPS, RELATIONS, etc.); domain-specific names allowed when standard ones don't fit.
- **DOC-FORM-07**: IDENTIFIERS first, RELATIONS/INDEX last; omit empty groups entirely.

### Lifecycle (DOC-LIFE)

- **DOC-LIFE-01**: Never commit temporary tags (`TODO`, `FIXME`, `DEBUG`, `TEMP`, `QUESTION`, `IDEA`, `INTENT`).
- **DOC-LIFE-02**: Review tags (`REVIEW`, `REFACTOR`, `OPTIMIZE`) allowed in drafts only, removed before merge.
- **DOC-LIFE-03**: Persistent tags (`NOTE`, `IMPORTANT`, `WARNING`, `SECURITY`, `PERFORMANCE`, `COMPATIBILITY`, `LIMITATION`, `HACK`, `WORKAROUND`) only when they add long-term value.
- **DOC-LIFE-04**: When behavior changes, update or remove related comments/JSDoc in the same PR.

## Patterns

### When to Add Comments

Add comments only when intent is non-obvious: business-rule rationale, constraints, tradeoffs, or external workarounds. If the code reads clearly without a comment, omit it.

### JSDoc Shape Decision

| Condition | Shape |
|---|---|
| No parameters, returns `void`/`Promise<void>` | One-line JSDoc: `/** summary */` |
| Has parameters, non-void return, `@throws`, or examples | Multi-line JSDoc block |

### Comment Casing Guide

| Context | Casing |
|---|---|
| Explanatory comments | lowercase sentence style |
| JSDoc summaries | lowercase, verb-first |
| Section headers (e.g., `// --- USER --- //`) | UPPERCASE allowed |
| Code/type/acronym references | Original casing (`UserService`, `OAuth`) |

### Section Dividers (DOC-FORM-05, DOC-FORM-06, DOC-FORM-07)

Use `// --- NAME --- //` to separate logical groups within data structures and files. Format: 3 dashes each side, UPPERCASE text, spaces between all elements.

**TypeScript Interface:**

```typescript
interface Product {
  // --- IDENTIFIERS --- //
  id: number;

  // --- PROPERTIES --- //
  name: string;
  price: number;

  // --- FLAGS --- //
  isActive: boolean;

  // --- TIMESTAMPS --- //
  createdAt: Date;
  updatedAt: Date;

  // --- RELATIONS --- //
  categoryId: string;
}
```

**Prisma Model:**

```prisma
model User {
  // --- IDENTIFIERS --- //
  id        String   @id @default(cuid())

  // --- PROPERTIES --- //
  name      String
  email     String   @unique

  // --- FLAGS --- //
  isActive  Boolean  @default(true)

  // --- TIMESTAMPS --- //
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // --- RELATIONS --- //
  posts     Post[]
  profile   Profile?
}
```

**Object Literal:**

```typescript
const user = {
  // --- INDEX --- //
  id: '...',

  // --- DISPLAY --- //
  email: '...',
  name: '...',

  // --- AUTHENTICATION DETAILS --- //
  passwordHash: '...',
  lastLogin: '...',

  // --- PERMISSIONS --- //
  isActive: true,
  roles: ['admin'],
}
```

**Shell/Bash** (uses `##` wrapper):

```bash
## --- CONFIGURATION --- ##
LOG_LEVEL="info"

## --- HELPERS --- ##
log() { echo "$1"; }
```

## Anti-Patterns

- Large JSDoc blocks for trivial private helpers.
- Copy-pasted comments that drift across implementations.
- Style drift between modules (`Title Case`, lowercase, mixed punctuation).

## Quick Decision Tree

1. Is the reason not obvious? Add a concise comment (`DOC-CONT-01`).
2. Documenting a function/type contract? Apply JSDoc shape and style rules (`DOC-FORM-02`, `DOC-FORM-03`, `DOC-FORM-04`).
3. Before commit, remove temporary and review tags (`DOC-LIFE-01`, `DOC-LIFE-02`).
4. During refactor, update or remove stale comments (`DOC-LIFE-04`).
5. Grouping members in a data structure? Use section dividers if 3+ logical groups (`DOC-FORM-05`, `DOC-FORM-06`, `DOC-FORM-07`).
