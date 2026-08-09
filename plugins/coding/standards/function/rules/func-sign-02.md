# FUNC-SIGN-02: Parameter Signature Policy

## Intent

Use positional parameters only for up to two required arguments with obvious order. Use one object parameter when there are 3+ inputs, optional/config flags, or same-typed arguments that make call-site ordering ambiguous.

## Fix

```typescript
// ✅ positional parameters: ≤2 required, intuitive order
function add(a: number, b: number): number {
  return a + b;
}

function getUserById(id: string): Promise<User | null> {
  return userRepository.findById(id);
}

function formatDate(date: Date, format: string): string {
  return date.toLocaleDateString("en-US", { format });
}
```

### Object Parameter for Complex Input

```typescript
interface CreateUserOptions {
  name: string;
  email: string;
  role?: string;
  sendWelcomeEmail?: boolean;
  department?: string;
}

function createUser(options: CreateUserOptions): Promise<User> {
  const {
    name,
    email,
    role = "user",
    sendWelcomeEmail = true,
    department,
  } = options;
  // implementation
}

// usage
const user = await createUser({
  name: "John Doe",
  email: "john@example.com",
  role: "admin",
  sendWelcomeEmail: false,
});
```

### Rest Parameters for Variable Arguments

```typescript
function combine(separator: string, ...parts: string[]): string {
  return parts.filter(Boolean).join(separator);
}

function logEvent(eventName: string, { userId, ...metadata }: EventData): void {
  logger.info(eventName, {
    userId,
    metadata,
    timestamp: Date.now(),
  });
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `createUser(n,e,r,w,d)`, refactor before adding new behavior.
- If call sites become unclear without named arguments, switch to an object-parameter contract.

## Related

FUNC-SIGN-01, FUNC-SIGN-03, FUNC-SIGN-04
