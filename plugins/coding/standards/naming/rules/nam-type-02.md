# NAM-TYPE-02: Standard Parameter Vocabulary

## Intent

Use canonical parameter vocabulary by purpose: `params`, `query`, `input`, `options`, `data`, `config`, `context`, `details`, `logger`, `id`. Avoid non-semantic placeholders (`payload`, `cfg`, `extra`, `obj`) when a canonical term applies.

For class constructors, prefer `params` when the contract carries injected capability functions (substitutable in tests); prefer `config` when the contract carries durable structural settings (hosts, ports, schemas). Both are canonical — the choice is a design decision, not a lint violation. See `NAM-TYPE-03` for the companion-type suffix that mirrors the parameter name.

## Fix

```typescript
// canonical parameter names by purpose
function searchCommunities(params: SearchParams): SearchResult[] { /* ... */ }
function listUsers(query: UserQuery): User[] { /* ... */ }
function formatName(name: string, options?: FormatOptions): string { /* ... */ }
function setUser(data: SetUserData): Promise<void> { /* ... */ }
function initializeApp(config: AppConfig): void { /* ... */ }
function handleRequest(request: Request, context: RequestContext): Response { /* ... */ }
function processOrder(details: OrderDetails): ProcessedOrder { /* ... */ }
```

## Parameter Vocabulary

| Name | Usage |
|------|-------|
| `params` | Structured inputs that describe a command or query (filters, identifiers); also the canonical name for a class-construction contract carrying injected capabilities |
| `query` | Declarative filtering criteria for read operations |
| `input` | User-facing or form-submitted data |
| `options` | Optional modifiers that influence behavior without redefining the primary subject |
| `data` | Core subject matter being created or updated |
| `config` | Configuration objects or initialization settings; also the canonical name for class constructor parameters carrying durable structural settings (see `FUNC-SIGN-03`, `FUNC-SIGN-07`) |
| `context` | Execution context or request metadata |
| `details` | Supplementary metadata accompanying the main subject |
| `logger` | Logging instance |
| `id` | Record identifier |

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `fn(payload, cfg, extra)`, refactor before adding new behavior.
- **Class constructor `params` vs `config`** — both are canonical; pick `params` for capability-injecting contracts (function-typed fields), pick `config` for durable structural settings. Scanners MUST NOT false-positive either form on class constructors.
- **Legacy code** — existing classes using `config: { capabilities… }` (a `config` parameter that actually carries injected capability functions) are not retroactively in violation. Only new code MUST follow the capability-vs-structural split.

## Related

FUNC-SIGN-03, FUNC-SIGN-07, FUNC-ARCH-04, NAM-TYPE-01, NAM-TYPE-03, NAM-CORE-01, NAM-CORE-02
