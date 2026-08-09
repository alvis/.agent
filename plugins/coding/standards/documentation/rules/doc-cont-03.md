# DOC-CONT-03: Forbidden Comment Patterns

## Intent

Forbidden in committed code: author/date stamps, modified-by history, dead commented-out code, personal notes, and excessive punctuation. Keep history in git and move unresolved work items to issue tracking.

## Fix

```typescript
// sanitize to prevent XSS - never trust user input
const safe = sanitizeHtml(userContent);
```

```typescript
// legacy processing removed in v2.0 - see PR #123
processModern(data);
```

## Comments to Avoid

```typescript
// ❌ BAD: version history (use git instead)
// modified by John on 2024-01-15
// fixed bug #123

// ❌ BAD: noise comments
/**
 * Constructor
 */
constructor() { }

// ❌ BAD: commented-out code for "just in case"
// might need this later
// function oldImplementation() { }

// ❌ BAD: personal notes
// I think this could be better but deadline is tight

// ❌ BAD: excessive punctuation
// WARNING!!!! DO NOT CHANGE THIS!!!!!
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `// modified by A on 2025-01-10`, remove and refactor before adding new behavior.
- Noise comments like ❌ `/** Constructor */` are also forbidden; delete them.
- Comments that say ❌ `// might need this later` around dead code must be removed entirely.

## Related

DOC-CONT-01, DOC-CONT-02, DOC-LIFE-01, GEN-DESN-04
