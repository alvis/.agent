# State context discovery

Use this bounded order during diagnosis; do not scan all Markdown by recency:

1. Resolve the active work root from the Essential state contract.
2. Read `state/working.md`, then `state.md`.
3. Follow only links relevant to the diagnosed scope:
   - `review.md` and the named canonical area file for findings;
   - materialized `spec/` sources and versioned `docs/specs/` derivations;
   - relevant `design/` children and durable `docs/design/` or
     `docs/architecture/` paths;
   - linked decisions, evidence, validation output, or change children.
4. Treat source, test, and runtime evidence as authoritative over stale state;
   report contradictions to the PM for `state.md` reconciliation.

Extract exact issue IDs/locations, expected behavior, contract constraints,
blocked decisions, accepted assumptions/recheck triggers, and validation needed.
Review findings identify the defect; state/specification establish intended
behavior. Never auto-adopt root continuation, draft, plan, or design files.
