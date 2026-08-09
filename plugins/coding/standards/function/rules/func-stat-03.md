# FUNC-STAT-03: Prefer Pure Functions

## Intent

Default to deterministic, side-effect-free functions for transformation logic.

## Fix

```typescript
function add(a: number, b: number): number {
  return a + b;
}

function calculateTotal(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.price, 0);
}
```

### Segregate Side Effects from Pure Logic

Keep pure business logic separate from side effects:

```typescript
// pure business logic
function calculateTotal(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.price, 0);
}

// side effects in outer layer
async function processOrder(order: Order): Promise<void> {
  const total = calculateTotal(order);    // pure
  await saveOrder(order.id, total);       // side effect
}
```

### When Impure Functions Are Acceptable

Use impure functions for I/O operations, state management, event handlers, and side effects:

```typescript
// ✅ clearly impure for I/O
async function saveUser(user: User): Promise<void> {
  await database.users.insert(user);
  await emailService.sendWelcome(user.email);
  logger.info("User created", { userId: user.id });
}

// ✅ event handler with side effects
function handleButtonClick(): void {
  analytics.track("button_clicked");
  updateUIState();
  showNotification("Action completed");
}
```

### Where to Use Pure Functions

- **Data transformations** - Mapping, filtering, reducing
- **Calculations** - Math operations, aggregations
- **Formatters** - String formatting, date formatting
- **Validators** - Input validation, business rule checks
- **Utilities** - Helper functions, converters

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `logger.info(calc(x))` mixing pure logic with side effects, refactor before adding new behavior.
- Use pure functions for data transformations, calculations, formatters, validators, and utilities. Reserve impurity for I/O boundaries.

## Related

FUNC-STAT-01, FUNC-STAT-02, FUNC-STAT-04
