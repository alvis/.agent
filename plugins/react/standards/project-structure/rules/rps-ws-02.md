# RPS-WS-02: Workspace Package Must Be Domain-Agnostic and Theme-Aware

## Rule

Nothing in the shared workspace React package (`packages/ui`, `@company/ui`) may import from any app's `features/**` or `app/**`, and nothing in it may encode a client, brand, or tenant identity. All visual variation flows through the CSS-variable contract defined by the `theming` standard, and component variants stay semantic.

## Intent

The workspace package is the cross-app surface — every app in the monorepo depends on it. The moment it carries an app-specific feature import or a brand-coded prop, it stops being a shared package and becomes a hidden coupling: every other app inherits a concept it doesn't have, and every brand/tenant change ripples through the package's API instead of through theme tokens.

All visual variation must flow through the CSS-variable contract defined by `theming` (`WT-CONTRACT-01`). Component variants stay semantic (`variant="primary" | "secondary" | "danger"`), never brand-coded — see `WT-VARIANT-01`. A brand difference is expressed at the app root (e.g., `[data-brand="acme"]` scoping a CSS-variable set), not as a prop on a workspace component. This keeps the workspace package's API stable across apps and pushes brand identity to where it belongs: the consuming app.

The same rule applies to domain identity: a workspace component must not know about `Invoice`, `Order`, `User`, or any other domain shape. Domain-typed props turn the workspace package into a feature package and re-introduce the cross-feature coupling that `RPS-FEAT-01` exists to prevent — except now the coupling is across apps.

## Do (✅)

- Semantic variant API: `<Button variant="primary">`, `<Button variant="danger">`. The visual difference between Acme's primary and Globex's primary is a CSS-variable override at the app root, not a prop on `Button`.
- Brand scoping at the app root: `apps/acme/src/app/layout.tsx` wraps the tree in `<body data-brand="acme">`, and the theme CSS defines `[data-brand="acme"] { --color-primary: …; }` per `WT-CONTRACT-01`.
- One-off visual variation handled by a CSS-variable override in the consuming app, not by a new prop in the workspace package: `<Card style={{ '--card-padding': '2rem' }}>`.
- A `useMediaQuery` hook in `packages/ui/src/hooks/` that knows nothing about the consuming app's routing, analytics, or environment.

## Don't (❌)

- `client="acme" | "globex"` (or `theme="acme"`, `tenant="acme"`) prop on a workspace component. Brand/tenant identity must not appear in the package's public API.
- Importing from any app's `features/`: `import { Invoice } from 'apps/web/src/features/billing/types/Invoice'` inside `packages/ui/src/composites/InvoiceCard.tsx`. The workspace package must not know about `Invoice`.
- Importing from any app's `app/`: `import { useRouter } from 'apps/web/src/app/...'` inside a workspace-package component.
- Hard-coding brand color literals into a workspace component class: `.ui-button { background: #ff6600; }`. Use `var(--color-primary)` and let the consuming app supply the value via `WT-CONTRACT-01`.
- Branching on a `client` value internally (`if (client === 'acme') { … }`) — same violation as the prop, just hidden one layer down.

## Related

- `RPS-WS-01` — when the hoist to the workspace package is allowed in the first place.
- `WT-CONTRACT-01` — the CSS-variable contract that carries all visual variation across apps and brands.
- `WT-VARIANT-01` — semantic variants are the only variant API; brand-coded variants are forbidden.
- `RC-PROPS-01` — component prop API hygiene; brand/tenant props are a specific instance of the prop-shape anti-pattern.
