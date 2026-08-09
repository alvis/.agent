# TYP-TYPE-02: Interface Documentation Required

## Intent

Public interfaces and exported contract types must include compliant JSDoc.

## Fix

```typescript
/** represents a user in the system */
interface User {
  /** identifies the user uniquely */
  id: string;
  /** stores user's full name */
  name: string;
  /** provides email address for authentication */
  email: string;
}
```

### Group Related Fields

```typescript
/** API response wrapper with pagination support */
interface ApiResponse<T> {
  // response data //
  data: T;
  pagination?: PaginationInfo;
  // metadata //
  status: number;
  requestId: string;
}
```

### Violation

```typescript
// ❌ BAD: missing documentation on exported interface
interface User {
  id: string;
  name: string;
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `interface User { id: string }` (no JSDoc), refactor before adding new behavior.

## Related

TYP-TYPE-01, TYP-TYPE-03, TYP-TYPE-04
