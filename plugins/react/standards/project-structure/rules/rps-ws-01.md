# RPS-WS-01: Hoist to Workspace Package on Second App Consumer

## Rule

In a monorepo, hoist a React component or hook to the shared workspace package (e.g. `packages/ui`, `@company/ui`) **only when a second app in the same monorepo actually consumes it** — never on the basis of a single app's usage, and never speculatively.

## Intent

In a monorepo, the trigger to move a component or hook into a shared workspace React package is the **second app** consuming it — not the second feature, not the second route, not a guess that "another app might want this." Within one app, the existing in-app ladder (`RPS-PROMO-01`) is the rule: route-local → `features/<domain>/components/` → `src/components/<bucket>/`. The workspace package is the next tier up, and it is reached only when a real second app shows up.

A `packages/ui` consumed by exactly one app is not a workspace package — it is a misplaced `src/components/`. It carries all the costs of cross-package boundaries (build graph, versioning, publish surface, type-stripping rules) with none of the benefit (real reuse across apps). Worse, it locks in an API and a publish contract before a second app has ever expressed what it actually needs, so the first time a second app arrives the package has to be refactored or forked.

Within one app the existing `RPS-PROMO-01` ladder applies; the workspace package is the next tier up — reached only after the in-app tiers have been used and a real second-app consumer materializes.

## Do (✅)

- `apps/web` and `apps/admin` both consume `Button` with identical props, behavior, and accessibility shape → hoist `Button` from `apps/web/src/components/primitives/` to `packages/ui/src/primitives/Button.tsx`. Both apps import from `@company/ui`.
- A `useMediaQuery` hook is duplicated in `apps/web/src/utilities-react/` and `apps/admin/src/utilities-react/` with the same signature → hoist to `packages/ui/src/hooks/useMediaQuery.ts`.
- A theme-aware, domain-agnostic `Card` composite is proven in `apps/web/src/components/composites/` and is now needed in `apps/marketing/` with the same prop shape → hoist to `packages/ui/src/composites/Card.tsx`. Brand variation continues to flow through CSS variables, not props (`WT-CONTRACT-01`).

## Don't (❌)

- Creating `packages/ui` in a monorepo that has exactly one app, on the theory that "we'll add a second app eventually." Until the second app exists and consumes the component, the code belongs in that one app's `src/components/<bucket>/`.
- Hoisting `InvoiceCard` to `packages/ui` because two **features** inside the same app use it — that is the `RPS-PROMO-01` trigger inside the app, not the workspace-package trigger. Promote within the app instead.
- Hoisting a feature-specific component (e.g., `BillingSidebar`, `CheckoutSummary`) to `packages/ui` because a second app "also has billing." Feature-shaped code does not belong in the workspace package even when the shape repeats — it belongs in a shared feature package or stays duplicated until the shape is proven.
- Creating `packages/ui` and importing from `apps/web/src/features/**` inside it to make the hoist "work." That is a circular monorepo dependency and a violation of `RPS-WS-02`.

## Related

- `RPS-PROMO-01` — in-app promotion ladder; the prerequisite to ever considering a workspace-package hoist.
- `RPS-WS-02` — the workspace package must stay domain-agnostic and theme-aware.
- `WT-CONTRACT-01` — CSS-variable contract that lets one workspace component serve many app themes.
- `WT-VARIANT-01` — semantic variants (`primary`/`secondary`/`danger`) instead of brand-coded variants.
