# Data Entity: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

Any single violation blocks submission by default.

## Quick Scan

- DO NOT define entity fields without consistent role-based grouping and field documentation [`DEN-SHAP-01`]
- DO NOT leave nullability, finite states, timestamps, or optional relations implicit [`DEN-SHAP-02`]
- DO NOT let Prisma names, nullability, states, defaults, or relations diverge from the application entity [`DEN-PRIS-01`]
- DO NOT omit explicit identity, uniqueness, database-name, timestamp, table, or frequent-filter index decisions [`DEN-PRIS-02`]

## Rule Matrix

| Rule ID | Violation | Bad Examples |
|---|---|---|
| `DEN-SHAP-01` | Ungrouped or undocumented entity fields | Mixed identifiers and relations; undocumented fields |
| `DEN-SHAP-02` | Implicit domain shape | Nullable value typed non-null; status typed as unrestricted `string` |
| `DEN-PRIS-01` | Application/schema drift | Optional TypeScript field backed by required Prisma field; mismatched enum values |
| `DEN-PRIS-02` | Missing storage contract | Missing `@unique`; missing `@map`; no index decision for a frequent filter |
