# React Project Structure

_Standards for where React code lives: routes, features, shared components, utilities, and types — and how code is promoted between them._

## Dependent Standards

🚨 **[IMPORTANT]** You MUST also read the following standards together with this file

- React Component Standards (standard:components) - Component naming, props, state, and performance rules apply to every file placed under this layout
- File Naming Standards (plugin:coding:standard:file-structure) - PascalCase component files, camelCase hook files, and co-located tests/stories underpin the directory layout

**Note**: This standard requires the coding plugin to be enabled for referenced coding standards.

## Core Principles

### Decision Order

Where new code lands follows a strict first-yes-wins ladder: **workspace-package → route → feature → shared → utility → type**. If the code only serves one route, it belongs route-local. If it is reused across routes inside one domain, it belongs in `features/<domain>/`. If it is domain-agnostic UI, it belongs in `src/components/<bucket>/`. If it is React-unaware logic, it belongs in `src/utilities/`. Only globally-shared types belong in `src/types/`. Stop at the first match — never skip a tier.

If the codebase is a monorepo and a second app needs the building block, the next promotion target is the shared workspace React package (e.g. `@company/ui`, `packages/ui`), not the app's local `src/components/`.

### Gravitational Pull

Code starts at the lowest tier (route-local) and gets promoted outward only when a second consumer actually appears. New code does not enter `src/components/` or `src/features/` speculatively. Reuse is the trigger; not "this might be reused later." Demotion is allowed and expected — when reuse evaporates, move code back inward.

### Import Direction

Imports flow strictly one-way: `app/` → `features/` → `components/` → `utilities/`. Never reverse (no `src/components/` importing from `features/` or `app/`). Never sideways between sibling features (no `features/billing/` importing from `features/profile/`). Cross-feature reuse means promoting the shared piece down into `src/components/` or `src/utilities/`.

## What's Stricter Here

This standard enforces requirements beyond typical React/Next.js conventions:

| Standard Practice                                     | Our Stricter Requirement                                                            |
|-------------------------------------------------------|-------------------------------------------------------------------------------------|
| Route-local code in `app/<route>/_components/`        | **Route-local folder is `components/` (no underscore prefix)**                      |
| Mix presentational and container components freely    | **Strict container/presentational split inside `features/<domain>/`**               |
| Group shared UI under any bucket name                 | **Allowed buckets are: primitives, layouts, composites, headless, boundaries, providers, adapters** |
| `containers/` folder under shared components          | **Containers belong inside features only — never under `src/components/`**          |
| `features/shared/` or `features/ui/` as a catch-all   | **"shared" is not a domain — domain-agnostic UI lives under `src/components/`**     |
| `utilities/` may import React for "helper hooks"      | **`utilities/` is React-unaware: no JSX, no hooks, no React imports**               |
| Promote to shared on first guess                      | **Promote only on the second real consumer; demote when reuse evaporates**          |
| Shared by default across apps                         | **Hoist to workspace package only on second app consumer; never a single-app catch-all** |

## Exception Policy

Allowed exceptions only when:

- False positive
- No viable workaround exists now

Required exception note fields:

- `rule_id`
- `reason` (`false_positive` or `no_workaround`)
- `evidence`
- `temporary_mitigation`
- `follow_up_action`

If exception note is missing, submission is rejected.

## Rule Groups

- `RPS-LAYOUT-*`: Top-level decision order — which tier code belongs to (route → feature → shared → utility → type).
- `RPS-ROUTE-*`: `src/app/` rules — route-local `components/` folder naming; `page.tsx` as composition layer only.
- `RPS-COMPS-*`: `src/components/` rules — allowed bucket subfolders, no domain names, no upward imports.
- `RPS-FEAT-*`: `src/features/<domain>/` rules — container/presentational split, no cross-feature imports, no `shared/`/`ui/` domain.
- `RPS-UTIL-*`: `src/utilities/` and `src/types/` rules — pure & React-unaware; no domain types in global `types/`.
- `RPS-PROMO-*`: Promotion rules — second-consumer trigger, demotion when reuse evaporates.
- `RPS-WS-*`: Monorepo / shared-package rules — when to hoist a component or hook to a workspace package, what belongs there, what does not.
