# FUNC-SIGN-05: Explicit Exported Contracts

## Intent

Exported functions MUST use dedicated parameter/result interfaces/types where contracts are non-trivial.

## Fix

```typescript
export interface CreateUserParams {
  name: string;
  email: string;
  role?: string;
}

export interface CreateUserOptions {
  sendWelcomeEmail?: boolean;
  validateEmail?: boolean;
}

export function createUser(
  params: CreateUserParams,
  options?: CreateUserOptions,
): Promise<User> {
  // implementation
}
```

### Simple Exported Function with Trivial Contract

Trivial single-primitive contracts do not need a dedicated interface:

```typescript
export function getUserById(id: string): Promise<User | null> {
  return userRepository.findById(id);
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `export function createUser(p:any)`, refactor before adding new behavior.
- Internal (non-exported) functions with simple signatures do not require separate interface types.

## Related

FUNC-SIGN-01, FUNC-SIGN-02, FUNC-SIGN-03, TYP-PARM-02
