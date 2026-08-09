# NAM-DATA-04: Iteration Variable Clarity

## Intent

Use descriptive iteration identifiers (`user`, `product`, `item`) for non-trivial loops and functional chains. Single-letter aliases (`i`, `j`) are acceptable only for tiny index loops where extra semantics add no value.

## Fix

```typescript
// descriptive iteration names in functional chains and for-of loops
const activeEmails = users
  .filter((user) => user.isActive)
  .map((user) => user.email);

for (const product of products) {
  updateInventory(product);
}
```

### Short Aliases in Numeric Index Loops

```typescript
// short aliases acceptable in tiny numeric index loops
for (let i = 0; i < matrix.length; i++) {
  total += matrix[i];
}

// descriptive names required for nested or non-trivial loops
for (const [index, order] of orders.entries()) {
  processOrder(order, index);
}
```

### Disallowed Cryptic Variables

| Disallowed | Use Instead |
|------------|-------------|
| `for (const u of users)` | `for (const user of users)` |
| `for (const p of products)` | `for (const product of products)` |
| `items.map(i => ...)` | `items.map(item => ...)` |

## Variable Selection Decision Tree

- **Collection?** -> Use plural (e.g., `users`, `products`)
- **Map/dictionary?** -> Use `*By*` or `*To*` pattern (see `NAM-DATA-02`)
- **Boolean?** -> Use `is*`, `has*`, `can*`, `should*` prefix (see `NAM-DATA-03`)
- **Time-related?** -> Include unit (`Ms`, `Seconds`, `Minutes`, etc.) (see `NAM-CORE-04`)
- **Constant?** -> Global = UPPER_SNAKE_CASE, Local = camelCase (see `NAM-CORE-02`)

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `for (const x of items) {}`, refactor before adding new behavior.
- `i`, `j` are acceptable only for simple numeric index loops; all other iteration variables should be descriptive.

## Related

NAM-DATA-01, NAM-DATA-02, NAM-DATA-03
