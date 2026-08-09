# DOC-CONT-01: Explain Why, Not What

## Intent

Write comments only for non-obvious intent: business-rule rationale, constraints, tradeoffs, or external workarounds. If a comment only mirrors code syntax or names, remove it. "Mirrors code" means the comment **literally restates the adjacent code statement** (e.g., `// set x to 5` above `x = 5`), not that it merely relates to the same topic as the code.

## Fix

```typescript
// keep 5-minute cache to protect the upstream rate limit during burst traffic
cache.set(cacheKey, payload, { ttlSeconds: 300 });
```

```typescript
// pre-sort for binary search efficiency on repeated lookups
const sortedData = data.sort((a, b) => a.id - b.id);
```

```typescript
// assume UTC timezone since user timezone not provided
const date = new Date(timestamp);
```

```typescript
// matches email with optional '+' addressing (e.g., user+tag@example.com)
const emailRegex = /^[^\s@]+(\+[^\s@]+)?@[^\s@]+\.[^\s@]+$/;
```

```typescript
// sanitize to prevent XSS - never trust user input
const safe = sanitizeHtml(userContent);
```

## When to Write Comments

Add comments only when intent is non-obvious:

- **Purpose or reasoning** that is not immediately obvious
- **Workarounds** for external constraints or legacy issues
- **Intentional deviations** from best practices
- **Complex algorithms** needing explanation
- **Business logic** that is not self-evident

## Comment Density

- **Minimize comments** by writing self-explanatory code
- **Strategic placement** -- comment complex sections, not every line
- **Quality over quantity** -- few meaningful comments beat many obvious ones

## What NOT to Document

```typescript
// ❌ BAD: stating the obvious
/** gets the user's name */
function getName(user: User): string {
  return user.name; // ❌ BAD: obvious comment
}

// ❌ BAD: redundant comments
const users: User[] = []; // ❌ BAD: type is already clear

// ❌ BAD: restating the code
function calculateTotal(items: Item[]): number {
  let total = 0; // initialize total to zero
  for (const item of items) {
    total += item.price; // add item price to total
  }
  return total; // return the calculated total
}

// ✅ GOOD: explain business logic instead
function calculateTotal(items: Item[]): number {
  // apply bulk discount for orders over $100
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  return subtotal > 100 ? subtotal * 0.9 : subtotal;
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `// increment i`, refactor before adding new behavior.
- Regex or bitwise logic usually warrants a short "why" comment even if the code is technically readable.
- If a comment only restates what the code already says (e.g., ❌ `// increment counter by 1`), delete it rather than rewriting.
- Comments with persistent tags (`NOTE:`, `IMPORTANT:`, `WARNING:`, `SECURITY:`, etc.) are governed by `DOC-LIFE-03` -- never remove them under this rule.

## Related

DOC-CONT-02, DOC-CONT-03, DOC-FORM-03
