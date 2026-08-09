# TYP-TYPE-05: Result-Style Handling for Expected Failures

## Intent

For expected operational failures, prefer typed result unions over exception-only control flow.

## Fix

```typescript
// pattern template
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };
```

### Real-World Example

```typescript
async function fetchUser(id: string): Promise<Result<User, FetchError>> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      return { success: false, error: new FetchError("User not found") };
    }
    return { success: true, data: await response.json() };
  } catch (err) {
    return { success: false, error: new FetchError("Network error", { cause: err as Error }) };
  }
}

// safe usage with type narrowing
const result = await fetchUser("123");
if (result.success) {
  console.log(result.data.name); // data is safely typed
} else {
  console.error(result.error.message);
}
```

### Specific Error Types

```typescript
// ✅ GOOD: specific error types
class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

function parseUser(input: unknown): Result<User, ValidationError> {
  if (!isValidUserInput(input)) {
    return { success: false, error: new ValidationError("Invalid input", "input") };
  }
  return { success: true, data: input };
}
```

### Async Result Pattern

```typescript
type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

async function safeFetch(url: string): AsyncResult<Response, FetchError> {
  // implementation
}
```

### Error Handling Strategy

- **Can the error be recovered from?**
  - YES: Use Result pattern or return optional
  - NO: Throw an exception

- **Is this function expected to fail in normal operation?**
  - YES: Use Result pattern (discriminated union)
  - NO: Use exceptions (unexpected failures)

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `throw new Error("not found")`, refactor before adding new behavior.

## Related

TYP-TYPE-01, TYP-TYPE-06, TYP-CORE-01
