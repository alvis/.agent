# FUNC-SIGN-07: Constructor Injection Shape

## Intent

Class constructors MUST take exactly one object parameter — typed as `XXXParams` or `XXXConfig` — and destructure each capability into a precisely-named `#privateField`. Never store the parameter object whole as a `#dependencies` / `#deps` / `#services` / `#internals` bag, and never expand the contract into multiple positional parameters. The constructor contract is the class's public seam; an explicit, capability-shaped object keeps that seam discoverable, testable, and refactor-safe.

## Fix

```typescript
// ✅ GOOD: one object param, each capability destructured into a named #field
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

### Anti-Pattern — Dependency Bag

```typescript
// ❌ BAD: storing the param object whole as an opaque bag
class SearchService {
  #dependencies: SearchServiceParams;

  constructor(dependencies: SearchServiceParams) {
    this.#dependencies = dependencies;
  }
}
```

### Anti-Pattern — Positional Parameters

```typescript
// ❌ BAD: positional explosion — no companion type, no destructuring seam
class SearchService {
  constructor(repo: Repo, log: Log, cache: Cache) {
    /* … */
  }
}
```

### Field Name Mirrors Capability Name

```typescript
// ✅ GOOD: #field names the capability 1:1
class SearchService {
  readonly #tokenizeSearchQuery: (query: string) => Token[];
  /* … */
}

// ❌ BAD: lossy abbreviations — `#tokenize` and `#tokenizer` discard the object
class SearchService {
  readonly #tokenize: (query: string) => Token[];
  readonly #tokenizer: (query: string) => Token[];
}
```

## Edge Cases

- **Zero-dependency constructors** omit the parameter entirely (`constructor() {}`) — there is no contract to name.
- **Split `params` + `options`** — when a class needs both capability injection AND optional runtime helpers, split into two parameters (`constructor(params: XXXParams, options?: XXXOptions)`); delegates to `FUNC-SIGN-03`.
- **Subclass `super(params)` chains** — pass the same object through (`constructor(params: ChildParams) { super(params); /* destructure child-only fields */ }`); do NOT re-flatten into positional args at the `super` boundary.
- **Indexed-access type form** — `readonly #tokenizeSearchQuery: SearchServiceParams['tokenizeSearchQuery']` is permitted but not required; prefer the plain function-type form for readability, and reach for indexed-access only when the capability type is long enough that single-source-of-truth materially helps.

## Related

FUNC-SIGN-02, FUNC-SIGN-03, FUNC-SIGN-05, FUNC-ARCH-04, TYP-PARM-04, TYP-TYPE-03, NAM-TYPE-02, NAM-TYPE-03
