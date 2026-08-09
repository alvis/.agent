# DOC-CONT-04: Public API and Type Documentation

## Intent

Document exported APIs, interfaces, and complex types where behavior/contract is not self-evident. Trivial private helpers do not need JSDoc; this rule targets exported/public APIs only.

## Fix

```typescript
/** request contract for creating a billing profile */
export interface CreateBillingProfileRequest {
  accountId: string;
  region: string;
}
```

```typescript
/**
 * validates and normalizes user email address
 * @param email raw email input from user
 * @returns normalized email address
 * @throws {ValidationError} when email format is invalid
 */
export function normalizeEmail(email: string): string {
  // implementation
}
```

## Interface and Type Documentation

```typescript
/** user account information with authentication details */
interface User {
  /** unique identifier for the user account */
  readonly id: string;

  /** user's display name, max 100 characters */
  name: string;

  /** normalized email address used for authentication */
  email: string;

  /** user roles for authorization (admin, editor, viewer) */
  roles: string[];

  /** account creation timestamp */
  readonly createdAt: Date;
}

/** configuration for API client initialization */
interface ApiClientConfig {
  /** base URL for all API requests */
  baseUrl: string;

  /** request timeout in milliseconds (default: 5000) */
  timeout?: number;

  /** maximum number of retry attempts (default: 3) */
  maxRetries?: number;

  /** authentication token for API access */
  authToken?: string;
}
```

```typescript
/** supported HTTP methods for API requests */
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/** payment processing status during transaction lifecycle */
type PaymentStatus =
  | "pending" // initial state, awaiting processing
  | "processing" // currently being processed by payment provider
  | "completed" // successfully processed
  | "failed"; // processing failed, user notified

/**
 * result wrapper for operations that may succeed or fail
 * eliminates need for try-catch in consuming code
 */
type Result<TData, TError = Error> =
  | { success: true; data: TData }
  | { success: false; error: TError };
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `export interface X {}` without docs, add documentation before adding new behavior.
- Trivial private helpers do not need JSDoc; this rule targets exported/public APIs only.
- Complex `Result<T, E>` wrapper types benefit from a short JSDoc explaining the pattern.

## Related

DOC-CONT-01, DOC-FORM-02, DOC-FORM-03
