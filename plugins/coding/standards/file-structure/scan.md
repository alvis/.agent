# File and Directory Structure Standards: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

Any single violation blocks submission by default.

## Quick Scan

- DO NOT use non-kebab-case source filenames except PascalCase React component files and tooling-prescribed names [`FST-NAME-01`]
- DO NOT choose a filename whose noun/verb shape conflicts with its primary export [`FST-NAME-02`]
- DO NOT repeat type context already supplied by a typed parent directory or use a generic single word when a specific name is available [`FST-NAME-03`]
- DO NOT put unrelated exports in one module [`FST-MODL-01`]
- DO NOT put implementation logic in an index or violate the barrel-to-barrel and barrel-to-leaf export boundary [`FST-MODL-02`]
- DO NOT split an over-limit file before relocating misplaced concerns, or scatter remaining helpers into sibling files instead of `<base>/` [`FST-MODL-03`]
- DO NOT commit environment configuration without the required documented example file or violate the defined override order [`FST-ENVR-01`]

## Rule Matrix

| Rule ID | Violation | Bad Examples |
|---|---|---|
| `FST-NAME-01` | Wrong file casing | `UserService.ts`; `user_service.ts`; `userservice.ts` |
| `FST-NAME-02` | Filename conflicts with export shape | `user-validator.ts` exporting only `validateUser()` |
| `FST-NAME-03` | Generic or path-redundant name | `services/user-service.ts`; `utils.ts`; `helpers.ts` |
| `FST-MODL-01` | Unrelated exports share a module | User validation and currency formatting in one file |
| `FST-MODL-02` | Invalid index/barrel boundary | Logic in `index.ts`; `export * from './user-service'` |
| `FST-MODL-03` | Arbitrary or scattered long-file split | `anthropic.schema.ts`; `adapters/anthropic/anthropic-schema.ts` | <!-- doc-path-gate: ignore -->
| `FST-ENVR-01` | Environment contract incomplete | `.env.production` without `.env.production.example`; undocumented variables |
