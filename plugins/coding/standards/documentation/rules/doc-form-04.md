# DOC-FORM-04: Parameter Description Style

## Intent

`@param` descriptions start lowercase by default and describe semantics, not TypeScript types. Capitalize only when the first token is a proper type/interface/acronym reference.

## Fix

```typescript
/**
 * sends confirmation email
 * @param userId unique user identifier
 * @param amount payment amount in cents
 * @param options optional configuration settings
 */
function sendConfirmation(userId: string, amount: number, options?: Options): Promise<void> {
  return notifier.send(userId, amount, options);
}
```

```typescript
/**
 * persists user data
 * @param user User object containing profile data
 * @param config ApiConfig instance for initialization
 * @param status PaymentStatus enum value
 */
function persistUser(user: User, config: ApiConfig, status: PaymentStatus): void {
  // implementation
}
```

## Parameter Documentation Patterns

Destructured and nested parameters use dot notation:

```typescript
/**
 * creates new user account with validation and welcome email
 * @param userData user information for account creation
 * @param userData.name full name of the user
 * @param userData.email valid email address (will be normalized)
 * @param userData.password password meeting security requirements
 * @param options optional configuration for account creation
 * @param options.sendWelcomeEmail whether to send welcome email (default: true)
 * @param options.role user role assignment (default: 'user')
 * @returns promise resolving to created user with generated ID
 */
async function createUser(
  userData: {
    name: string;
    email: string;
    password: string;
  },
  options: {
    sendWelcomeEmail?: boolean;
    role?: string;
  } = {},
): Promise<User> {
  // implementation
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `@param userId User Identifier`, refactor before adding new behavior.
- ❌ `@param userId The unique identifier` is wrong; `The` is not a type reference, so lowercase to `the unique identifier`.
- ❌ `@param user the user object` is wrong if referring to `User` type; capitalize to `User object containing profile data`.
- Omit hyphens after parameter names in `@param` tags (use space, not dash).

## Related

DOC-FORM-01, DOC-FORM-02, DOC-FORM-03
