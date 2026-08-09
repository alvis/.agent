# NAM-DATA-01: Singular vs Plural Discipline

## Intent

Use singular names for one entity/value object (`user`, `config`) and plural names for collections/aggregates (`users`, `settings`, `options`). Do not store arrays/maps under singular names.

## Fix

```typescript
// singular for single entities, plural for collections
const user = await getUserById(id);
const users = await listActiveUsers();
const config = loadAppConfig();
const settings = getNotificationSettings();
```

## Collection Naming

Plural form signals aggregation:

```typescript
// plural form signals aggregation even with one current property
interface NotificationOptions {
  enabled: boolean;
}
const orderItems: OrderItem[] = cart.getItems();
const activeEmployees = employees.filter((employee) => employee.isActive);
```

### Disallowed Singular for Collections

| Disallowed | Use Instead |
|------------|-------------|
| `user` (for array) | `users`, `userList`, `activeUsers` |
| `item` (for array) | `items`, `orderItems`, `cartItems` |
| `list` (generic) | `users`, `products`, `orders` (specific plural) |

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `const user = []`, refactor before adding new behavior.
- Use plural for settings/options objects (`options`, `settings`, `preferences`) even if they currently have a single property, to signal grouped configuration and future expansion.

## Related

NAM-DATA-02, NAM-DATA-03, NAM-DATA-04
