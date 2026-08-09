# RPS-LAYOUT-01: Decision Order — Route → Feature → Shared → Utility → Type

## Intent

Every piece of code in `src/` has exactly one correct home, decided by a strict ladder: **route → feature → shared → utility → type**. Apply the questions in order and stop at the first yes. This prevents the most common project-structure failure mode — code that is "vaguely shared" ending up in `src/components/` or `src/utilities/` before it has earned its place, dragging coupling and accidental APIs along with it.

## Fix

When code is in the wrong tier:

- Code in `src/components/` that only one route uses → move to `src/app/<route>/components/`.
- Code in `src/components/` that is domain-scoped → move to `src/features/<domain>/components/` (or `containers/` if it fetches).
- Code in `src/utilities/` that renders JSX or uses hooks → it is a component, not a utility. Move it to the appropriate tier above.
- Code in `src/types/` that is domain-specific (e.g., `Invoice`, `User`) → move to `src/features/<domain>/types/`.
- Features that reach upward into `src/app/` for shared parts → invert: extract the shared parts down into `src/components/` or `src/utilities/`.

## Code Superpowers

- Walk every file in `src/` and classify by tier (`app/`, `features/`, `components/`, `utilities/`, `types/`); flag any file whose contents do not match its tier (e.g., JSX in `utilities/`, a domain type in `types/`).
- Build an import graph and flag any import edge that violates one-way flow (`app/` → `features/` → `components/` → `utilities/`).
- For each shared component, count distinct consumers; flag single-consumer entries as candidates for demotion (see `RPS-PROMO-01`).

## Common Mistakes

1. Placing a component in `src/components/` "because it might be reused" before the second consumer exists.
2. Putting a hook in `src/utilities/` because it feels like a helper — hooks are React.
3. Putting `Invoice` in `src/types/` because both `billing` and `profile` import it, when only `billing` owns the concept.
4. Creating `src/components/billing/` instead of `src/features/billing/components/`.
5. Letting `src/app/<route>/page.tsx` directly call domain `api/` functions instead of composing a feature container.

## Edge Cases

- **Cross-domain primitive type** (e.g., `Pagination`, `ApiResponse<T>`): genuinely cross-cutting types belong in `src/types/`. The test: does any feature own this concept? If no — it goes in `src/types/`.
- **Auth/Session**: typically promoted to `src/features/auth/` with a provider exported into `src/components/providers/AppProviders.tsx`. The provider is shared, the domain logic is not.
- **Marketing pages**: large public-facing pages are usually all route-local under `src/app/`. They rarely need a `features/` entry.

## Related

- `RPS-ROUTE-01`, `RPS-ROUTE-02` — route-local rules
- `RPS-COMPS-01`, `RPS-COMPS-02` — shared component rules
- `RPS-FEAT-01`, `RPS-FEAT-02`, `RPS-FEAT-03` — feature rules
- `RPS-UTIL-01` — utilities & types rules
- `RPS-PROMO-01` — promotion rules
- `plugin:coding:standard:file-structure` — file naming and co-location
