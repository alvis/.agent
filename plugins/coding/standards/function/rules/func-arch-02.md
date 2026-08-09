# FUNC-ARCH-02: Multi-line Text Construction

## Intent

Use `Array.join("\n")` for multi-line messages rather than repeated concatenation.

## Fix

```typescript
const errorMessage = [
  "Validation failed:",
  "- Email is required",
  "- Password must be at least 8 characters",
  "- Username already taken",
].join("\n");
```

## When to Use Array Join vs Template Literals

- **Array join**: Building lists, multi-segment text, or dynamic line assembly.
- **Template literals**: Acceptable for simple two-part messages where readability is clear.

```typescript
// ✅ array join for list-style messages
const summary = [
  `Order #${orderId}`,
  `Items: ${items.length}`,
  `Total: ${formatCurrency(total)}`,
].join("\n");

// ✅ template literal acceptable for simple two-part message
const greeting = `Hello, ${name}!`;
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `msg += "- Email is required\n"` or ❌ `let message = "Validation failed:\n";`, refactor before adding new behavior.
- Template literals are acceptable for simple two-part messages; use array join when building lists or multi-segment text.

## Related

FUNC-ARCH-01, FUNC-ARCH-03
