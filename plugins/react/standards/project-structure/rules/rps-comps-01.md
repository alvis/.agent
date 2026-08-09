# RPS-COMPS-01: `src/components/**` Must Not Import from `features/**` or `app/**`

## Intent

`src/components/` is the project's domain-agnostic UI library. Any file under it must be safe to lift into a sibling project, a Storybook, or a design system package without dragging domain code or route code with it. Importing from `features/` or `app/` would make shared components depend on domain types or route structure — which inverts the dependency direction, locks the component to a specific domain, and breaks reuse. The flow is one-way: `app/` → `features/` → `components/` → `utilities/`.

## Fix

When `src/components/<bucket>/<File>.tsx` imports from `features/**` or `app/**`:

- **If the import is a domain type**: the component is not domain-agnostic. Move it into the owning feature's `components/` folder, or refactor to accept generic props (e.g., `id: string`, `label: string`) instead of a domain shape.
- **If the import is a feature component**: the dependency is upward. Either inline the needed piece into this shared component, or invert — turn the shared component into a "slot" that the feature composes.
- **If the import is from `app/`**: never correct. Route-local code cannot be reached from shared. Refactor to remove the dependency entirely.

## Code Superpowers

- For every file under `src/components/**`, list its imports. Flag any import path that starts with `#features/`, `@/features/`, `~/features/`, `../features/`, `#app/`, `@/app/`, `~/app/`, or `../app/`.
- For every file under `src/components/**`, scan for type references that match known domain type names (e.g., `Invoice`, `User`, `Project`). Flag any usage that would couple this component to a domain.
- Verify the public API of each shared component is expressed in generic types or local types, never in feature-owned types.

## Common Mistakes

1. Importing `Invoice` from `#features/billing/types/Invoice` into `src/components/composites/Card.tsx` instead of accepting `{ title, subtitle, body }` props.
2. A "shared" `UserBadge` that imports `useCurrentUser` from `#features/auth/hooks/` — the badge should accept the user as a prop.
3. A shared layout reaching into `#app/dashboard/...` for a config value — config should be passed in.

## Edge Cases

- **Provider components in `src/components/providers/`**: these may import other providers from `src/components/providers/` but still must not import from `features/` or `app/`. If a provider needs domain config, accept it as a prop.
- **Adapters in `src/components/adapters/`**: these wrap third-party libraries (e.g., `@radix-ui/react-tabs`). Importing from the third-party library is fine; importing from `features/` or `app/` is not.
- **Generic types from `src/types/`**: importing from `src/types/` is allowed (it is the lower tier).

## Related

- `RPS-COMPS-02` — allowed buckets under `src/components/`
- `RPS-FEAT-01` — no cross-feature imports
- `RPS-LAYOUT-01` — decision order and import direction
- `standard:components` — component shape rules
