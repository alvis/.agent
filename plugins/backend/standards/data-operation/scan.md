# Data Operations: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

Any single violation blocks submission by default.

## Quick Scan

- DO NOT use noncanonical CRUD verbs or give a canonical verb different semantics [`DOP-CONT-01`]
- DO NOT use weak input/output types, omit boundary validation, or return multiple missing-result sentinels [`DOP-CONT-02`]
- DO NOT implement unique retrieval without normalization and a `null` missing result [`DOP-SING-01`]
- DO NOT split create/update behavior when the operation is the required typed `set` upsert [`DOP-SING-02`]
- DO NOT hard-delete without an allowed-status constraint or return inconsistent absence results [`DOP-SING-03`]
- DO NOT use `search` without natural-language capability or `list` for natural-language queries [`DOP-COLL-01`]
- DO NOT issue unbounded collection queries or omit sensible filter, pagination, and sorting defaults [`DOP-COLL-02`]
- DO NOT scatter entity selectors/normalizers, combine operations, or put business logic in controller wrappers [`DOP-STRU-01`]
- DO NOT omit mirrored unit/integration tests for success, absence, defaults, filters, and destructive constraints [`DOP-STRU-02`]

## Rule Matrix

| Rule ID | Violation | Bad Examples |
|---|---|---|
| `DOP-CONT-01` | Noncanonical operation semantics | `fetchUsers()`; `createUser()`; `deleteUser()` |
| `DOP-CONT-02` | Weak or unpredictable contract | `getUser(id: any): Promise<any>`; `User \| undefined \| false` |
| `DOP-SING-01` | Inconsistent unique retrieval | Throwing for an ordinary miss; returning an unnormalized database record |
| `DOP-SING-02` | Non-upsert set contract | Separate create/update paths with incompatible inputs or returns |
| `DOP-SING-03` | Unsafe deletion | Deleting active records; propagating Prisma P2025 as an ordinary miss |
| `DOP-COLL-01` | List/search semantic mismatch | `searchUsers({ status })` with no query capability |
| `DOP-COLL-02` | Unbounded or unstable collection query | `findMany()` without `take`; no default ordering |
| `DOP-STRU-01` | Scattered or thick data layer | Selectors in controllers; several operations in one file |
| `DOP-STRU-02` | Incomplete operation coverage | Set tests only creation; drop test does not verify deletion |
