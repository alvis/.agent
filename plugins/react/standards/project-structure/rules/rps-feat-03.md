# RPS-FEAT-03: No `features/shared/` or `features/ui/` — "Shared" Is Not a Domain

## Intent

`src/features/<domain>/` is for **named domains** (billing, profile, search, auth). "Shared" and "ui" are not domains — they are catch-all buckets that recreate the very problem the layout was designed to prevent. Allowing `features/shared/` lets unrelated code collect there with no semantic boundary; over time it grows into a second, undocumented `src/components/` that violates the one-way import rule. Domain-agnostic UI belongs in `src/components/<bucket>/`. Domain-agnostic logic belongs in `src/utilities/`. There is no third option.

## Fix

When you find `src/features/shared/` or `src/features/ui/`:

1. **Triage each file by character:**
   - Domain-agnostic UI component → `src/components/<bucket>/` (`primitives/`, `composites/`, etc.)
   - Domain-agnostic React-unaware function → `src/utilities/`
   - Domain-agnostic React hook → currently we have **no** sanctioned home for "shared hooks." Place it in `src/components/<bucket>/` adjacent to the consuming component if there is one, or in a feature if it is domain-tied. If a genuine cross-cutting hook surfaces (e.g., `useMediaQuery`), it usually lives in `src/components/primitives/` or `src/components/headless/` next to the component that owns it.
   - Domain-specific code → its actual `src/features/<domain>/`
2. **Delete the empty `features/shared/` or `features/ui/` folder.**
3. **Update imports** project-wide.

```plaintext
// ❌ BAD layout
src/features/
├── shared/             # catch-all — forbidden
│   ├── Button.tsx
│   ├── formatDate.ts
│   └── useDebounce.ts
└── billing/

// ✅ GOOD layout
src/
├── components/primitives/Button.tsx
├── utilities/formatDate.ts
├── features/billing/...
└── ... (useDebounce placed adjacent to its primary consumer)
```

## Code Superpowers

- List immediate children of `src/features/`. Flag any folder named `shared`, `ui`, `common`, `lib`, `core`, `misc`, or other generic catch-alls.
- For each file in a flagged folder, suggest a destination based on file contents (JSX present → component; `react` import only → likely a hook; otherwise → utility).

## Common Mistakes

1. Starting a new project with `features/shared/` "just for the first few weeks" — it never leaves.
2. Renaming `features/shared/` to `features/common/` — same anti-pattern, different name.
3. Justifying it as "this code is shared between features so where else would it go?" — the answer is `src/components/` or `src/utilities/`. That is the whole point of those tiers.

## Edge Cases

- **`features/auth/`**: auth is a real domain (current user, sessions, permissions) and is allowed. Multiple features importing from `auth/` is fine — that's its purpose.
- **`features/i18n/`**: internationalization is a real cross-cutting concern; if you model it as a feature it can have hooks, types, and a provider. Alternative: keep the provider in `src/components/providers/` and the lookup utility in `src/utilities/`. Pick one approach and document it.
- **Design tokens, theming**: these are not a feature. They live in `src/components/providers/ThemeProvider.tsx` and a theme module imported from `src/utilities/` or `src/types/`.

## Related

- `RPS-FEAT-01` — no cross-feature imports
- `RPS-COMPS-02` — shared UI lives in `src/components/<bucket>/`
- `RPS-UTIL-01` — shared logic lives in `src/utilities/`
- `RPS-LAYOUT-01` — decision order
