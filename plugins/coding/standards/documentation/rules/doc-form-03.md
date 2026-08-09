# DOC-FORM-03: JSDoc Prose Sentence Style

## Intent

All JSDoc prose — function summaries, `@returns` descriptions, `@throws` descriptions, `@example` body descriptions, and any free `* …` prose lines — must start lowercase and omit a trailing period. Function summaries must additionally use a present-tense third-person verb (`validates`, `returns`, `creates`). Noun phrases and verbose forms like `This function ...` are non-compliant on functions.

This rule covers every prose line inside `/** ... */` except `@param` descriptions, which `DOC-FORM-04` owns separately (it allows a different exception set for type/interface references).

**Exception**: the first word may be uppercase when it is a code/type/acronym reference (`UserService validates ...`, `JWT token ...`, `URL parsed from ...`, `PascalCaseSymbol ...`).

## Fix

```typescript
/**
 * validates webhook signature
 *
 * @returns true when the signature matches
 * @throws SignatureMismatchError when the digest is invalid
 *
 * @example
 *   the caller invokes this from the request handler
 *   verifyWebhook(request)
 */
function validateWebhookSignature(input: SignatureInput): boolean {
  return verifier.matches(input);
}

/** ensures required environment variables exist */
function ensureEnv(): void {}
```

## In-Scope JSDoc Prose

Every prose line below must follow lowercase-no-period rules:

| Location | Lowercase | No trailing period |
|----------|-----------|--------------------|
| Function summary | ✅ | ✅ |
| Interface / type / constant summary | ✅ | ✅ |
| `@returns description` | ✅ | ✅ |
| `@throws description` | ✅ | ✅ |
| `@example` body prose (non-code lines) | ✅ | ✅ |
| Free `* …` prose between tags | ✅ | ✅ |
| `@param description` | (owned by `DOC-FORM-04`) | (owned by `DOC-FORM-04`) |

Code lines inside `@example` blocks are not prose — leave their casing/punctuation alone.

## Non-Functions: Noun Phrases

Non-function elements (interfaces, types, constants) use descriptive noun phrases, not verb forms:

```typescript
/** configuration options for API client initialization */
interface ApiConfig {
  baseUrl: string;
  timeout: number;
}

/** user authentication and profile information */
interface User {
  id: string;
  email: string;
}

/** supported payment methods for transaction processing */
type PaymentMethod = "credit_card" | "paypal" | "bank_transfer";

/** maximum number of retry attempts for failed requests */
const MAX_RETRY_ATTEMPTS = 3;
```

## Quick Reference

| Element | Format | Example |
|---------|--------|---------|
| Function summary | 3rd person verb, lowercase, no period | `/** validates user input */` |
| Interface | Noun phrase, lowercase, no period | `/** user account information */` |
| Type | Descriptive phrase, lowercase, no period | `/** payment processing status */` |
| Constant | Descriptive phrase, lowercase, no period | `/** maximum retry attempts */` |
| `@returns` | Lowercase, no period | `* @returns the verified user` |
| `@throws` | Lowercase, no period | `* @throws auth error when token is invalid` |
| `@example` prose | Lowercase, no period | `* @example` then `*   parses ISO timestamps` |
| Free `* …` prose | Lowercase, no period | `* note: requires the env var to be set` |

## Edge Cases

- ❌ `/** Validates email address format. */` has two violations: capital V and trailing period.
- ❌ `/** Email validation */` is a noun phrase on a function; rewrite to `/** validates email address format */`.
- ❌ `/** This function validates email */` is verbose; rewrite to `/** validates email address format */`.
- ❌ `* @returns The user object.` → ✅ `* @returns the user object`.
- ❌ `* @throws Error if input is invalid.` → ✅ `* @throws an error when input is invalid`.
- ✅ `* @returns JWT token signed with HS256` — first word is an acronym reference, allowed.
- ✅ `* UserService.validate runs before persistence` — first word is a code reference, allowed.
- ✅ Code lines inside `@example`: `*   const result = parse("2024-01-01")` — not prose, untouched.
- ❌ Unnecessary multi-line for simple void functions: use one-line `/** ensures required environment variables exist */` instead.

## Related

DOC-FORM-01, DOC-FORM-02, DOC-FORM-04
