# TYP-TYPE-06: Guard Unknown Input Before Use

## Intent

Narrow unknown data using guard functions before reading fields. Never trust raw external payloads.

## Fix

```typescript
// basic type guard pattern
function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value
  );
}
```

### Composed Type Guards

```typescript
function isUserArray(value: unknown): value is User[] {
  return Array.isArray(value) && value.every(isUser);
}
```

### Type Guards for Discriminated Unions

```typescript
type ApiResult =
  | { status: "success"; data: User }
  | { status: "error"; message: string };

function isSuccessResult(result: ApiResult): result is Extract<ApiResult, { status: "success" }> {
  return result.status === "success";
}

const result: ApiResult = await fetchUser();
if (isSuccessResult(result)) {
  console.log(result.data.name); // TypeScript knows result.data exists
}
```

### Reusable Type Predicate Pattern

```typescript
function isType(value: unknown): value is TargetType {
  return (
    typeof value === "object" &&
    value !== null &&
    "requiredField" in value
  );
}

function processData(data: unknown): void {
  if (!isUser(data)) {
    throw new ValidationError("Invalid user data");
  }
  // data is now safely typed as User
  console.log(data.email);
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `const user = payload as User`, refactor before adding new behavior.

## Related

TYP-TYPE-01, TYP-CORE-01, TYP-CORE-03
