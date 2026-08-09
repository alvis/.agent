# NAM-FUNC-04: Canonical Data Operation Verbs

## Intent

Persisted-data operations must follow a strict verb taxonomy: `Search<Entity>`/`List<Entity>` for multi-item reads, `Get<Entity>` for single-item reads, `Set<Entity>` for create/update/upsert, and `Drop<Entity>` only for irreversible deletion. Do not use ambiguous verbs (`FindById`, `Query*`, `process*`) for persisted operations.

## Fix

```typescript
// canonical data operation verbs
GetUser({ id: "user-123" });
ListUsers({ filter: { isActive: true } });
SearchUsers({ query: "security engineers in nyc" });
SetUser({ id: "user-123", status: "active" });
```

## Multi-Item Reads

- **`Search<Entity>`** -- Full-text or semantic queries that accept natural-language `query` input:

  ```typescript
  SearchCommunities({ query: "climate tech in europe", filter, limit });
  ```

- **`List<Entity>`** -- Structured, rule-based filtering without natural language:

  ```typescript
  ListCommunities({ filter: { country: "UK" }, limit });
  ```

Avoid vague verbs like `Find` or `Query`; pick either `Search` or `List` based on the available capability.

## Single-Item Reads

**`Get<Entity>`** -- Retrieve exactly one record using a parameter object (id, slug, etc.):

```typescript
GetUser({ id: "user-123" });
GetWorkspace({ slug: "north-america" });
```

Avoid names like `FindById` or `Fetch` that leak implementation details.

## Mutations

**`Set<Entity>`** -- Create or update a persisted entity (supports upsert semantics):

```typescript
SetProduct({ id: "prod-1", name: "Updated name" });
SetUser({ name: "New user", email: "user@example.com" });
```

## Destructive Operations

**`Drop<Entity>`** -- Irreversible removal of a persisted record:

```typescript
DropProduct({ id: "prod-1" });
```

Drop operations are discouraged. Prefer `Set<Entity>` with a status field (for example `status: "inactive"`) to implement soft-delete semantics when possible.

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `FindUserById(id)` or ❌ `process()`, refactor before adding new behavior.
- Choose `Search` vs `List` based on input type (natural-language vs structured filter), then choose `Get`/`Set`/`Drop` by record cardinality and durability effect.
- Avoid vague verbs like `Find`, `Query`, `Fetch` for persisted-data operations.

## Related

NAM-FUNC-01, NAM-FUNC-02, NAM-FUNC-03
