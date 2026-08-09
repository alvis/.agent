# FUNC-SIGN-03: Standard Parameter Names

## Intent

Use canonical semantic names: `params` (structured query/command input, OR class constructor capability contract — see `FUNC-SIGN-07`), `options` (optional modifiers), `data` (primary payload), `config` (initialization), `context` (execution metadata), `details` (supplemental metadata). Avoid opaque placeholders like `payload`, `cfg`, and `extra` when a canonical name fits.

## Fix

```typescript
function getUserProfile(params: { userId: string }): Promise<User> {
  return api.get(`/users/${params.userId}`);
}
```

### `options` for Optional Configuration

```typescript
interface FormatOptions {
  locale?: string;
  currency?: string;
  precision?: number;
}

function formatPrice(amount: number, options: FormatOptions = {}): string {
  const { locale = "en-US", currency = "USD", precision = 2 } = options;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: precision,
  }).format(amount);
}
```

### `data` for Primary Payload

```typescript
function createUser(data: CreateUserData): Promise<User> {
  return api.post("/users", data);
}

function updateProfile(userId: string, data: UpdateProfileData): Promise<User> {
  return api.patch(`/users/${userId}`, data);
}
```

### `config` for Initialization

```typescript
interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  ssl?: boolean;
  poolSize?: number;
}

class Database {
  constructor(config: DatabaseConfig) {
    this.config = config;
    this.connect();
  }
}
```

### `params` for Capability Constructors

```typescript
interface SearchServiceParams {
  tokenizeSearchQuery: (query: string) => Token[];
  readContextSource: (id: string) => Promise<Source>;
}

class SearchService {
  readonly #tokenizeSearchQuery: (query: string) => Token[];
  readonly #readContextSource: (id: string) => Promise<Source>;

  constructor(params: SearchServiceParams) {
    const { tokenizeSearchQuery, readContextSource } = params;
    this.#tokenizeSearchQuery = tokenizeSearchQuery;
    this.#readContextSource = readContextSource;
  }
}
```

Use `params` for class-construction contracts that carry injected capabilities (function-typed fields the class calls). See `FUNC-SIGN-07` for the destructured-`#field` shape.

### `context` for Execution Metadata

```typescript
interface RequestContext {
  user: User;
  requestId: string;
  permissions: string[];
}

function checkAccess(resource: Resource, context: RequestContext): boolean {
  if (resource.ownerId === context.user.id) return true;
  if (context.permissions.includes("admin")) return true;
  return false;
}
```

### `details` for Supplemental Metadata

```typescript
interface ErrorDetails {
  code: string;
  field?: string;
  originalError?: Error;
}

function logError(message: string, details: ErrorDetails): void {
  logger.error(message, {
    errorCode: details.code,
    field: details.field,
    stack: details.originalError?.stack,
  });
}
```

## `config` vs `options` — Semantic Distinction

`config` and `options` are NOT interchangeable. They carry distinct semantics:

- **`config`** — required by core logic to function. Describes *what the system is* at initialization time. May contain non-JSON-serializable references (class instances, schemas) only when those are structural to the system's identity. Typically passed to constructors and persisted for the lifetime of the instance. Absence of a required `config` field is a configuration error, not a runtime choice.

- **`options`** — optional runtime helpers the core logic can function *without*. Describes *how execution should behave or be observed* at call time. Common contents: runtime hooks (`onThinking`, `onProgress`, `onError`), callbacks, `log` loggers, retry/validation defaults, abort signals, per-call overrides, progress handlers. Options are ergonomic affordances; their absence never prevents the operation from running.

- **`params` (class-construction variant)** — capability-heavy ⇒ `params`; structural-value-heavy ⇒ `config`; split when both apply. When a class constructor carries injected capability functions (`tokenizeSearchQuery`, `readContextSource`), prefer `params`; when it carries durable structural settings (host, port, ssl), prefer `config`. See `FUNC-SIGN-07` for the destructured-`#field` shape.

### Rule of thumb

If removing the field would break the operation's ability to execute, it is `config`. If removing it would merely reduce observability or change a default, it is `options`.

### Split constructors when both apply

When a class needs both structural configuration and optional runtime helpers, split them into two constructor parameters rather than merging them into one mixed object:

```typescript
// GOOD — config is required structure, options is optional runtime behaviour
class Operator<T, C extends OperatorConfig = OperatorConfig> {
  constructor(config: C, options?: OperatorOptions<T>) { /* ... */ }
}

// BAD — mixing required providers/models with optional log/callbacks in one blob
class Operator<T> {
  constructor(configAndOptions: OperatorConfig<T> & { log?: Log; onError?: Handler }) { /* ... */ }
}
```

This keeps the `config` object JSON-serializable where possible, makes the required-vs-optional distinction obvious at the call site, and gives consumers a place to pass loggers/hooks without polluting the persisted configuration.

For class constructors, both `params` and `config` are canonical — the choice is a design decision (capability-heavy vs structural-value-heavy), not a lint violation. Scanners must not flag either form on class constructors.

> **Legacy code**: pre-existing classes that use `config: { capabilities… }` are not retroactively violating; only new code is required to follow the capability-vs-structural split.

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `fn(payload, cfg, extra)`, refactor before adding new behavior.
- Choose parameter names by role in the API contract, not by current implementation details.
- When a parameter could plausibly be either `config` or `options`, apply the rule-of-thumb above: required-to-execute is `config`, observability/defaults is `options`.

## Related

FUNC-SIGN-01, FUNC-SIGN-02, FUNC-SIGN-04, FUNC-SIGN-07, FUNC-ARCH-04, NAM-TYPE-02, NAM-TYPE-03, TYP-PARM-04
