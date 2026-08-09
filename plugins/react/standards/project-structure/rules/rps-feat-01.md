# RPS-FEAT-01: A Feature Must Not Import From Another Feature

## Intent

Each `src/features/<domain>/` owns one domain end-to-end and stands alone. A feature importing from a sibling feature creates a hidden coupling that bypasses the shared layer — the next consumer who needs the same piece either reaches into the same sibling (compounding coupling) or duplicates the code (silent fork). The correct way to share code between two features is to promote it: domain-agnostic pieces go to `src/components/<bucket>/` or `src/utilities/`; if the shared concept is itself a domain, it gets its own `features/<concept>/`.

## Fix

When `src/features/<A>/...` imports from `src/features/<B>/...`:

1. **Identify what's actually being shared.** Is it a type, a UI component, a hook, a utility function?
2. **Pick the destination by character:**
   - Pure function, no React → `src/utilities/`
   - Domain-agnostic UI → `src/components/<bucket>/`
   - Genuinely cross-cutting type → `src/types/`
   - A third domain that both features depend on → its own `src/features/<concept>/` (and both A and B may import from it — provided that concept truly is a domain on its own, e.g., `auth`)
3. **Move the shared piece** to the destination. Update both `<A>` and `<B>` to import from there.
4. **Forbid the direct edge.** Add the violation to lint configuration if available.

```typescript
// ❌ BAD: cross-feature import
// src/features/billing/containers/InvoiceListContainer.tsx
import { useCurrentUser } from '#features/profile/hooks/useCurrentUser';

// ✅ GOOD: shared auth concept lifted to its own feature
// src/features/billing/containers/InvoiceListContainer.tsx
import { useCurrentUser } from '#features/auth/hooks/useCurrentUser';
```

## Code Superpowers

- Build a feature-to-feature import graph. List all edges where `from = features/<A>/**` and `to = features/<B>/**` with `A !== B`. Each edge is a violation.
- For each edge, classify the imported symbol (type, component, hook, function) to inform the fix recommendation.
- Track recurring offenders — a feature with 5+ outgoing cross-feature imports likely needs to be split or its public API extracted to a shared layer.

## Common Mistakes

1. `billing` imports `User` from `profile/types/` — `User` is cross-cutting; promote to `src/types/` or split out `auth/types/User.ts`.
2. `search` imports a presentational card from `billing/components/` — the card is domain-agnostic in shape; promote it to `src/components/composites/`.
3. `dashboard` reaches into `billing/api/` to fetch invoices — this is correct *only if* the dashboard composes a billing container; the import target should be a container or hook, never another feature's `api/`.

## Edge Cases

- **Auth feature**: `auth` is the canonical exception's-shape — almost every feature reads the current user. Provide a clean public surface (`features/auth/hooks/useCurrentUser`, `features/auth/types/User`) and treat it as an implicit lower-tier dependency.
- **Cross-feature page composition**: a route's `page.tsx` may compose containers from multiple features (that's the whole point of routes) — this is not a cross-feature import; it's a route-to-feature import.
- **Shared barrel exports**: do not solve this by creating `src/features/index.ts` re-exporting everything; that defeats the rule.

## Related

- `RPS-COMPS-01` — shared layer cannot import from features
- `RPS-FEAT-02` — container/presentational split inside a feature
- `RPS-FEAT-03` — no `features/shared/` catch-all
- `RPS-LAYOUT-01` — decision order
- `RPS-PROMO-01` — promotion on second consumer
