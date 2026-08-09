# DOC-FORM-01: Comment Casing Rules

## Intent

Write explanatory comments and JSDoc summaries in lowercase sentence style. Uppercase is allowed only for canonical section headers (e.g., `// --- USER --- //`) and direct code/type/acronym references (`UserService`, `OAuth`, `HTTP`).

## Fix

```typescript
// ✅ GOOD: lowercase comments
// this function handles user authentication
// check if user exists before proceeding
```

```typescript
// ✅ GOOD: uppercase for code references
// the UserService handles authentication
// call the OAuth AS with proper headers
// the Layout component should be memoized
```

## Section Header Format

Section headers use the canonical uppercase format `// --- NAME --- //`:

```typescript
// ✅ GOOD: one-line section header
// --- USER --- //

// ✅ GOOD: test suites section
// --- TEST SUITES --- //
```

```typescript
// ❌ BAD: non-standard section formats
/* USER */
// USER //

//////////
// USER //
//////////
```

### Language-Aware Wrappers

| Language | Section Divider |
|---|---|
| TS/JS | `// --- NAME --- //` |
| Prisma | `// --- NAME --- //` |
| Shell/Bash | `## --- NAME --- ##` |

## Tag Formatting

For single-line and multi-line tagged comments, start the tag on its own line when content wraps:

```typescript
// ✅ GOOD: single-line format
// NOTE: skip root tsconfig to avoid circular refs

// ✅ GOOD: multi-line format
// NOTE:
// lockfile stored in workspace root only
// when shared-workspace-lockfile=true

// WARNING:
// this mutation is intentional for performance
// do not refactor to immutable without benchmarking
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `// This validates token`, refactor to lowercase before adding new behavior.
- If the line separates major file sections, use canonical uppercase header format `// --- NAME --- //`; otherwise use lowercase comment style.
- Non-standard section formats like ❌ `/* USER */`, ❌ `// USER //` (missing dashes), or ❌ `////////// // USER //` are non-compliant; use the `// --- NAME --- //` form.

## Related

DOC-FORM-02, DOC-FORM-03, DOC-FORM-04, DOC-FORM-05, DOC-FORM-06, DOC-FORM-07
