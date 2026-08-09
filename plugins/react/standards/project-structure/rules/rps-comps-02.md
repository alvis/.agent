# RPS-COMPS-02: Allowed Buckets Under `src/components/` — No Domain Names, No `containers/`

## Intent

`src/components/` is organized by **capability**, not by domain or by container/presentational split. The allowed subfolders are a closed set: `primitives/`, `layouts/`, `composites/`, `headless/`, `boundaries/`, `providers/`, `adapters/`. Adding domain-named folders here (e.g., `components/billing/`) breaks the one-way import rule and turns the shared layer into a second `features/`. Adding `containers/` here breaks the rule that containers are domain-aware and live inside features. The closed set keeps the shared layer reviewable at a glance and protects it from accidental domain creep.

## Fix

| Current folder                            | Move to                                                                           |
|-------------------------------------------|-----------------------------------------------------------------------------------|
| `src/components/billing/`                 | `src/features/billing/components/`                                                |
| `src/components/shared/`                  | Split files into the correct bucket (`primitives/`, `composites/`, etc.)          |
| `src/components/ui/`                      | Same as `shared/` — distribute into the correct buckets                           |
| `src/components/containers/`              | Move each container into its owning `src/features/<domain>/containers/`           |
| `src/components/utils/` (with components) | Components → correct bucket; utilities → `src/utilities/`                          |
| `src/components/<misc>/`                  | Pick the bucket by capability (see table in `write.md`)                            |

After moving, update imports project-wide and remove the now-empty disallowed folders.

## Code Superpowers

- List immediate children of `src/components/`. Flag any folder name not in `{primitives, layouts, composites, headless, boundaries, providers, adapters}`.
- For each file in `src/components/`, classify by capability (atomic styled element, layout wrapper, etc.) and confirm it lives in the matching bucket.
- Flag any file under `src/components/<bucket>/<DomainName>/` where `<DomainName>` matches a known domain in `src/features/<DomainName>/`.

## Common Mistakes

1. Creating `src/components/billing/` because "all billing UI should be together" — domain UI belongs in `features/billing/components/`.
2. Creating `src/components/containers/` for "all data-fetching components" — containers are domain-aware by definition (`RPS-FEAT-02`).
3. Dumping miscellaneous components into `src/components/shared/` or `src/components/ui/`.
4. Adding a new bucket (`src/components/utils/`, `src/components/forms/`) without amending this standard — the set is closed; expanding it requires an exception note and standard update.

## Edge Cases

- **Form components**: a generic styled `Form`, `Field`, `FieldGroup` belong in `composites/`. A headless form library wrapper belongs in `adapters/`. A billing-specific form belongs in `features/billing/components/`.
- **Charts**: a generic `LineChart` wrapping a charting library → `adapters/`. A styled wrapper on top → `composites/`. A billing-specific chart → `features/billing/components/`.
- **Icons**: a single icon library wrapper belongs in `adapters/` or `primitives/` depending on whether it adds project-local styling. Pick one and be consistent.
- **Boundaries**: `ErrorBoundary` and `SuspenseBoundary` go in `boundaries/`. Domain-specific error UIs (e.g., `BillingErrorFallback`) belong in `features/billing/components/`.

## Related

- `RPS-COMPS-01` — no upward imports from shared
- `RPS-FEAT-02` — containers live in features
- `RPS-FEAT-03` — no `features/shared/` either
- `RPS-LAYOUT-01` — decision order
- `standard:components` — component shape rules
