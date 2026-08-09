# DOC-LIFE-02: Review Tags Must Be Cleared

## Intent

Review-only tags (`REVIEW`, `REFACTOR`, `OPTIMIZE`) are allowed in drafts only and must be removed before merge. If context is still valuable, rewrite it as durable rationale without review-tag syntax.

## Fix

```typescript
// current approach uses linear scan; acceptable for < 1000 items
const match = items.find((item) => item.id === targetId);
```

```typescript
// batch processing approach chosen over streaming for simplicity - see PROJ-567 for follow-up
const results = await processBatch(records);
```

## Review Tags Reference

These tags are draft-only and must be cleared before merge:

| Tag | Purpose |
|-----|---------|
| `REVIEW` | needs second opinion on approach |
| `REFACTOR` | code needs restructuring |
| `OPTIMIZE` | performance could be improved |

```typescript
// ❌ BAD: these must not be merged
// REVIEW: need second opinion on this approach
// REFACTOR: this code needs restructuring
// OPTIMIZE: performance could be improved here
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `// REVIEW: revisit this`, rewrite as durable context or remove before merge.
- If the review tag highlights a genuine concern, convert it to an issue ticket and reference the ticket in a plain comment.
- ❌ `// REFACTOR: this code needs restructuring` must either be resolved or moved to an issue before merge.

## Related

DOC-LIFE-01, DOC-LIFE-03, DOC-LIFE-04
