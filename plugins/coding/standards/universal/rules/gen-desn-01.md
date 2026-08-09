# GEN-DESN-01: Single Responsibility

## Intent

Keep modules and classes focused on one clear purpose with coherent boundaries. Each module or class should have a single primary responsibility and one primary reason to change. For function-level single responsibility, see `FUNC-ARCH-01`.

## Fix

```typescript
// user-validation.ts — one concern: validating user data
import { z } from "zod";

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["admin", "member"]),
});

export function validateUser(input: unknown) {
  return userSchema.safeParse(input);
}

export function validateUserUpdate(input: unknown) {
  return userSchema.partial().safeParse(input);
}
```

## Focused Class

```typescript
// ✅ GOOD: single responsibility
class EmailValidator {
  validate(email: string): boolean { /* ... */ }
}

// ❌ BAD: multiple responsibilities in one class
class EmailManager {
  validate(email: string): boolean { /* ... */ }
  send(to: string, subject: string, body: string): void { /* ... */ }
  saveToDatabase(email: Email): void { /* ... */ }
  // doing too much!
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ a class handling validation, persistence, and notification together, refactor before adding new behavior.
- A module may export several related functions as long as they all serve the same cohesive purpose (e.g., a validation module with multiple schema validators).

## Related

FUNC-ARCH-01, GEN-DESN-02, GEN-DESN-03, GEN-DESN-04, GEN-CONS-01
