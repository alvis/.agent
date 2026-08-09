# File and Directory Structure Standards: Compliant Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

## Key Principles

- Use kebab-case except for PascalCase React component files.
- Name noun/object/class modules with nouns and function modules with verbs.
- Let typed directories carry type context; prefer one specific domain word.
- Keep only related exports together.
- Keep index files free of implementation logic and preserve barrel boundaries.
- Relocate misplaced concerns before splitting a long file.
- Document every environment variable and option in the matching example file.

## Core Rules Summary

### Naming (FST-NAME)

- **FST-NAME-01**: Use kebab-case for ordinary files, PascalCase for React components, and source-matching `.spec` names for tests.
- **FST-NAME-02**: Use a noun for a class/object module and a verb for a function module.
- **FST-NAME-03**: Prefer one specific domain word; omit a type suffix already expressed by a typed directory, retaining qualifiers only for ambiguity, collisions, verb+noun functions, tooling, or React conventions.

### Modules (FST-MODL)

- **FST-MODL-01**: Keep multiple exports together only when they share one domain concern.
- **FST-MODL-02**: Keep logic out of index files; use wildcard subpath aliases between barrels and explicit named exports from leaves, per `TYP-MODL-04`.
- **FST-MODL-03**: For files over the project's `max-lines`, relocate misplaced concerns first; if still long, preserve `<base>.ts` as a thin entry and place short-named helpers under `<base>/`.

### Environment (FST-ENVR)

- **FST-ENVR-01**: Use supported `.env` suffixes, provide a documented matching example for applications that consume variables, and preserve the override order.

## Patterns

### Naming by Context and Export

```text
services/user.ts          # typed directory supplies "service"
lib/user-service.ts       # suffix required without typed directory
validate-user.ts          # function validateUser()
user-validator.ts         # class UserValidator
services/user.spec.ts     # test matches its source
UserProfile.tsx           # React component
database.config.ts        # tooling suffix retained
types.ts                  # co-located module types
types/user.ts             # multiple type modules
```

Keep more than one word when a single word is ambiguous (`api-client.ts`), when names would collide, for verb-first function files, or when tooling/React requires it. Avoid interface prefixes and implementation suffixes such as `IUserService.ts` and `UserServiceImpl.ts`.

### Barrel Boundaries

```typescript
// barrel to barrel: subpath alias
export * from "#auth";

// barrel to leaf: explicit code exports, then types
export { UserService } from "./user-service";
export type { User } from "./types";
```

Do not define classes, functions, or business logic in `index.ts`. Do not wildcard-export a leaf or duplicate another barrel's surface with explicit picks.

### Long-File Decomposition

When a file exceeds the configured `max-lines`:

1. Move logic that belongs to an existing or proper new module to its real home, especially reused logic or a distinct standalone concern.
2. If the file remains over the limit, keep `<base>.ts` as the thin public entry/orchestrator and put helpers under `<base>/`.
3. Give helpers short contextual names because the folder already supplies the base.

```text
adapters/anthropic.ts          # thin entry and stable public surface
adapters/anthropic/schema.ts   # schemas
adapters/anthropic/parse.ts    # parsing
adapters/anthropic/request.ts  # request construction
```

Never create sibling fragments such as `anthropic.schema.ts` or repeat the base in `adapters/anthropic/anthropic-schema.ts`. <!-- doc-path-gate: ignore -->

### Environment Files

Supported forms are `.env`, `.env.<environment>`, `.env.<platform>`, and `.env.<platform>.<environment>`, including local variants. A consuming application provides `.env.<suffix>.example` with an explanation and allowed options for every line. Local override files are never committed.

Load later entries over earlier ones:

1. `.env`
2. `.env.local`
3. `.env.<platform>`
4. `.env.<platform>.local`

Examples include `.env.development`, `.env.production`, `.env.test`, and `.env.supabase.local`.

## Anti-Patterns

- Names that repeat the directory, such as `repositories/user-repository.ts`.
- Vague catch-alls such as `utils.ts` or `helpers.ts`.
- Deep nesting when a flatter structure keeps ownership clear; treat three to four levels as the navigation warning point, not a license to obscure domain boundaries.
- Unrelated exports grouped only to reduce file count.
- Helper fragments scattered beside the public entry.

## Quick Decision Tree

1. Is it a React component? Use PascalCase; otherwise use kebab-case (`FST-NAME-01`).
2. Is the primary export a function? Use verb+noun; otherwise use a noun (`FST-NAME-02`).
3. Does the parent directory already name the type? Drop that suffix unless ambiguity or collision requires it (`FST-NAME-03`).
4. Are exports unrelated? Split them into their real domain homes (`FST-MODL-01`).
5. Is this an index or barrel? Apply the barrel boundary and keep logic out (`FST-MODL-02`).
6. Is the file over `max-lines` after relocation? Use the thin-entry plus helper-directory pattern (`FST-MODL-03`).
7. Does the application consume environment variables? Add and document the matching example, then preserve override order (`FST-ENVR-01`).
