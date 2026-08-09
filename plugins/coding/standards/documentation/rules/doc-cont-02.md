# DOC-CONT-02: Inline Comments Must Add Value

## Intent

Inline comments should explain decisions and edge-case behavior, not mirror code syntax. A comment that restates code is noise and must be removed. "Restates code" means the comment **literally restates the adjacent code statement** (e.g., `// return the result` above `return result`), not that it merely relates to the same topic as the code.

## Fix

```typescript
// use Map for O(1) lookup performance with large datasets
const userIndex = new Map<string, User>();
```

```typescript
// customers get 20% discount after 3rd purchase in same month
const discount = purchases.length > 3 ? 0.2 : 0;
```

```typescript
// setTimeout with 0ms to push to next tick and avoid race condition
setTimeout(() => updateUI(), 0);
```

```typescript
// using any here because third-party library has incorrect types
const result = externalLib.process(data as any);
```

## Good vs Bad Inline Comments

```typescript
// ✅ GOOD: explains reasoning
// use Map for O(1) lookup performance with large datasets
const userIndex = new Map<string, User>();

// ✅ GOOD: explains business logic
// customers get 20% discount after 3rd purchase in same month
const discount = purchases.length > 3 ? 0.2 : 0;

// ✅ GOOD: explains deviation
// using any here because third-party library has incorrect types
const result = externalLib.process(data as any);
```

```typescript
// ❌ BAD: restates the obvious
// increment counter by 1
counter++;

// ❌ BAD: explains what instead of why
// loop through users array
users.forEach((user) => {});

// ❌ BAD: redundant with clear code
// return true if user is active
return user.isActive;

// ❌ BAD: obvious comment
// return the result
return result;
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `// set x to 1`, refactor before adding new behavior.
- A comment that restates code (e.g., ❌ `// return the result`) is noise; remove it entirely rather than trying to rewrite.
- Comments with persistent tags (`NOTE:`, `IMPORTANT:`, `WARNING:`, `SECURITY:`, etc.) are governed by `DOC-LIFE-03` -- never remove them under this rule.

## Related

DOC-CONT-01, DOC-CONT-03, DOC-CONT-04
