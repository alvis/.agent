# RPS-PROMO-01: Promote On the Second Consumer; Demote When Reuse Evaporates

## Intent

Code is promoted from a lower tier (route → feature → shared) to a higher tier **only when a second real consumer appears** — not speculatively, not on the first guess of "this might be reused." Premature promotion locks in an API and a coupling before the shape is proven, and the resulting "shared" component nearly always grows a half-dozen optional props to fit consumers it was never designed for. Conversely, **demotion is allowed and encouraged** — when reuse evaporates (the second consumer goes away, or it turns out two consumers actually need different things), the shared piece is moved back inward.

## Fix

**When you find a single-consumer shared component:**

1. Identify the one consumer. Is it route-local, feature-scoped, or actually used in two+ places via barrel re-exports?
2. If exactly one real consumer:
   - Single route → demote to `src/app/<route>/components/`
   - Single feature → demote to `src/features/<domain>/components/`
3. Update imports and delete the entry under `src/components/`.

**When you are tempted to create a new shared component:**

1. Stop. Is there a second real consumer **today**? Not a hypothetical one.
2. If no — keep the code at the lowest tier (route-local or feature-local). Use code duplication for now; duplication is recoverable.
3. If yes — promote it, but only **after** the second consumer's exact needs are visible. Design the shared API against both real call sites, not against one plus a guess.

**When two existing copies diverge before the second consumer needs them to:**

1. Compare the two copies. If the divergence is incidental (styling drift), reunify and promote.
2. If the divergence is structural (different props, different shape), they are not actually one component — leave them duplicated.

```plaintext
// Promotion path
src/app/dashboard/components/InvoiceCard.tsx
        │ second consumer in billing/ → promote
        ▼
src/features/billing/components/InvoiceCard.tsx
        │ second consumer in a DIFFERENT domain → promote
        ▼
src/components/composites/InvoiceCard.tsx
                                  // but wait — does it know about `Invoice`?
                                  // If yes, this is not domain-agnostic.
                                  // Refactor to accept generic props or keep in feature.
```

## Code Superpowers

- Build a consumer graph: for each file under `src/components/**`, count distinct importer files. Flag any with exactly 1 importer.
- For each file under `src/features/<domain>/components/`, count distinct importer files **outside of that same domain**. Flag any with 0 such importers as candidates for demotion to route-local (if the single consumer is in `app/`).
- For each shared component, scan its props. Count optional props of type literal-union (e.g., `variant?: 'a' | 'b' | 'c'`). Components with >4 such props are often "frankenstein" results of premature promotion serving too many guesses — flag for review.

## Common Mistakes

1. Promoting a new component to `src/components/` "because we always have shared components" — the second-consumer trigger is the rule.
2. Promoting on a guess about a future consumer that never materializes; the component then has to be refactored when the real second consumer appears with different needs.
3. Promoting cross-domain, then accepting a domain-typed prop on the shared component (e.g., `Invoice`) — that's `RPS-COMPS-01`. Promote only when the API can be expressed generically.
4. Refusing to demote a shared component out of attachment to "shared things are better" — single-consumer shared code is worse than route-local code.

## Edge Cases

- **Three consumers, all in one feature**: promote within the feature (route-local → `features/<domain>/components/`), not to `src/components/`.
- **One consumer today, but a design doc commits to a second next sprint**: still wait. The design will probably shift. Promote at the moment the second consumer is actually written.
- **Storybook stories as a "consumer"**: stories do not count as a consumer for promotion purposes. Stories should follow the component, not pull it upward.
- **Tests as a "consumer"**: same — tests follow the component.

## Related

- `RPS-LAYOUT-01` — decision order
- `RPS-COMPS-01` — shared components must be domain-agnostic
- `RPS-COMPS-02` — allowed buckets under `src/components/`
- `RPS-FEAT-01` — no cross-feature imports (promote instead)
- `standard:components` (especially `RC-PROPS-02`) — composition over prop explosion
