# DOC-FORM-02: JSDoc Shape and Structure

## Intent

Use one-line JSDoc only when there are no parameters and the return is `void`/`Promise<void>`. Use multi-line JSDoc whenever parameters, non-void returns, `@throws`, or examples are required.

## Fix

```typescript
/** flushes pending metrics */
function flushMetrics(): Promise<void> {
  return metrics.flush();
}
```

```typescript
/**
 * builds invoice summary for a billing period
 * @param params billing period and account context
 * @returns invoice summary totals
 */
function buildInvoiceSummary(params: InvoiceParams): InvoiceSummary {
  return summarizer.run(params);
}
```

## JSDoc Rules

- Begin with third-person singular verb (e.g., "validates" not "validate")
- Write all JSDoc in lowercase
- Parameter descriptions start with lowercase (unless referencing types/interfaces/acronyms)
- Omit hyphens after parameter names in `@param` tags
- Exclude TypeScript types from JSDoc (they are in the code)
- No periods at the end of JSDoc comments
- List all `@throws` with conditions

## Example Documentation

Use `@example` blocks with fenced code for usage demonstrations:

````typescript
/**
 * validates and normalizes user email address
 * @param email raw email input from user
 * @returns normalized email address
 * @throws {ValidationError} when email format is invalid
 *
 * @example
 * basic usage:
 * ```typescript
 * const email = normalizeEmail('  John.Doe@EXAMPLE.COM  ');
 * console.log(email); // 'john.doe@example.com'
 * ```
 *
 * @example
 * error handling:
 * ```typescript
 * try {
 *   const email = normalizeEmail('invalid-email');
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     console.error('Invalid email format:', error.message);
 *   }
 * }
 * ```
 */
function normalizeEmail(email: string): string {
  // implementation
}
````

## Complete Multi-Line Example

````typescript
/**
 * retrieves paginated list of users with optional filtering
 * @param filter optional filter criteria for user search
 * @param pagination pagination parameters with defaults
 * @returns promise resolving to paginated user results
 * @throws {ValidationError} when filter parameters are invalid
 * @throws {DatabaseError} when database query fails
 * @example
 * ```typescript
 * const users = await getUsers(
 *   { status: 'active', department: 'engineering' },
 *   { page: 1, limit: 20 }
 * );
 * ```
 */
async function getUsers(
  filter: UserFilter = {},
  pagination: PaginationParams = { page: 1, limit: 50 },
): Promise<PaginatedResult<User>> {
  // implementation
}
````

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `/** one line */ fn(a)`, refactor to multi-line before adding new behavior.
- A function with only `@throws` and no params still requires multi-line shape.
- Exclude TypeScript types from JSDoc; they are already in the code.

## Related

DOC-FORM-01, DOC-FORM-03, DOC-FORM-04
