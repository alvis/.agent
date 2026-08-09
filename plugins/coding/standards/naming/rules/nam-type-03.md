# NAM-TYPE-03: Class Companion Types & Capability Method Naming

## Intent

Every class MUST declare a companion contract type named `<ClassName>Params`, `<ClassName>Config`, or `<ClassName>Dependencies`. Each capability field on that contract MUST be an explicit action phrase that includes its object (e.g. `tokenizeSearchQuery`, not `tokenize`; `scoreSearchDocument`, not `score`). Each `#privateField` declared on the class MUST mirror the capability name 1:1. This rule extends `NAM-FUNC-01` (verbs-first) to **function-typed fields** inside contract types — short generic verbs on capability slots are a violation just as they are on standalone functions.

## Fix

```typescript
// ✅ GOOD: companion contract uses explicit action phrases; #fields mirror 1:1
interface SearchIndexDependencies {
  tokenizeSearchQuery(query: string): readonly string[];
  scoreSearchDocument(document: SearchDocument, query: SearchQuery): number;
  recordSearchMetric(metric: SearchMetric): void;
}

class SearchIndex {
  readonly #tokenizeSearchQuery: SearchIndexDependencies['tokenizeSearchQuery'];
  readonly #scoreSearchDocument: SearchIndexDependencies['scoreSearchDocument'];
  readonly #recordSearchMetric: SearchIndexDependencies['recordSearchMetric'];

  public constructor(params: SearchIndexDependencies) {
    this.#tokenizeSearchQuery = params.tokenizeSearchQuery;
    this.#scoreSearchDocument = params.scoreSearchDocument;
    this.#recordSearchMetric = params.recordSearchMetric;
  }
}
```

### Companion Type Suffix Selector

| When the contract carries… | Use suffix |
|---|---|
| Injected capabilities (function fields to be substituted in tests) | `<Class>Params` |
| Durable structural settings (hosts, schemas, serializable values) | `<Class>Config` |
| Pure DI contract — only capability functions, no data | `<Class>Dependencies` |

### Anti-Pattern

```typescript
// ❌ BAD: generic short verbs on capability slots (violates NAM-FUNC-01 on function-typed fields)
interface SearchIndexDeps {
  tokenize(query: string): readonly string[];
  score(document: SearchDocument, query: SearchQuery): number;
  record(metric: SearchMetric): void;
}

// ❌ BAD: abbreviation-suffixed companion type names
interface SearchIndexDeps { /* ... */ }
interface SearchIndexInputs { /* ... */ }
interface SearchIndexOpts { /* ... */ }

// ❌ BAD: #field names that do not mirror the contract slot 1:1
class SearchIndex {
  readonly #tokenize: SearchIndexDependencies['tokenizeSearchQuery'];
  readonly #score: SearchIndexDependencies['scoreSearchDocument'];
}

// ❌ BAD: bag-style dependency field instead of mirrored capability fields
class SearchIndex {
  readonly #deps: SearchIndexDependencies;
  readonly #dependencies: SearchIndexDependencies;
}
```

## Edge Cases

- **Overloaded capabilities with name collisions** — append the *object* to disambiguate (`scoreSearchDocument` vs `scoreSearchQuery`); never resolve the collision by shortening one side back to a generic verb.
- **Choosing between `Params` / `Config` / `Dependencies`** — defer to `NAM-TYPE-02` (param-name vocabulary) and `FUNC-SIGN-03` (config-vs-options-vs-params); the suffix follows the parameter name choice.
- **Function-typed fields are functions** — this rule extends `NAM-FUNC-01` to function-typed fields. Reviewers MUST NOT dismiss the action-phrase requirement on contract slots on the grounds that "it's a field, not a function".
- **Allowlisted full word, disallowed abbreviation** — even though `<Class>Dependencies` is the full-word form (and therefore permitted by `NAM-CORE-03`'s abbreviation allowlist), the abbreviated forms `<Class>Deps`, `#deps`, and `params.deps` remain disallowed.

## Related

NAM-CORE-01, NAM-CORE-03, NAM-TYPE-01, NAM-TYPE-02, NAM-FUNC-01, FUNC-SIGN-03, FUNC-SIGN-07, FUNC-ARCH-04, TYP-PARM-04, TYP-TYPE-03
