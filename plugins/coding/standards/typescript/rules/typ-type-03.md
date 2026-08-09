# TYP-TYPE-03: Strict Typing Patterns

## Intent

Use `readonly` where appropriate and private class fields as `#field` (not `private`) for runtime-enforced privacy.

## Fix

```typescript
// ✅ GOOD: readonly for immutable data
interface ReadonlyConfig {
  readonly apiUrl: string;
  readonly features: readonly string[];
}

// ✅ GOOD: private fields with #
class UserService {
  #repository: UserRepository;
  #cache = new Map<string, User>();
}
```

### Violation

```typescript
// ❌ VIOLATION: private keyword instead of #private
class Service {
  private repository: Repository; // use #repository instead
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `class S { private repo: Repo }`, refactor before adding new behavior.

## Related

TYP-TYPE-01, TYP-TYPE-02, TYP-TYPE-04, FUNC-SIGN-07, TYP-PARM-04
