# Durable documentation

Read this before creating or materially rewriting versioned project
documentation. `state.md` owns the cross-plugin lifecycle and
canonical tree; this reference owns the authority, content, ownership, and
migration rules for that tree.

## Entrypoints and semantic documents

- `docs/README.md` is the small entrypoint to architecture, design, capability
  specifications, and plugin-owned durable domains.
- A durable directory uses `README.md` only for its reader entrypoint.
  Operational indexes such as `.state/overview.md` and semantic documents such
  as `system.md`, `manifest.md`, and `assets.md` keep their descriptive names.
- `docs/architecture` owns structural rules, boundaries, topology, protocols,
  and flows. A choice with alternatives and consequences is an architectural
  decision record under `decisions`, never a second architecture truth. Follow
  [the ADR contract](adr.md) for current-only indexing and superseded archives.
- `docs/design` owns durable system-wide and feature design.

## Capability specifications

`docs/specs/<capability>/README.md` is the approved normative carrier and
begins with reader orientation: what the capability is, when to use it, how it
works, and overall usage direction. It does not repeat installation
instructions. For an inline source it becomes the reachable authority; for an
explicit reachable local source it is a content-equivalent carrier; for
Notion it is a verified derivation.

`provenance.json` records source revisions and content references, the approval
receipt, primary template identity, logical-unit mappings, and exact output
hashes. Add `reference.md` only for an intended consumer surface, including an
API intended for another package in the same repository; private helpers are
not a public surface.

## Plugin-owned domains

Durable user-facing domain documents live under `docs/<domain>/<slug>`. The
domain has a `README.md` for scope, lifecycle, and item navigation. Every item
has a `README.md` that maps readers to the plugin-owned semantic authority,
such as `manifest.md` or `assets.md`, without duplicating it. Add
`provenance.json` when that semantic document is derived.

Essential owns the shared entrypoint templates under `templates/docs`.
Specification owns its capability carrier, reference, and provenance
templates. Each domain plugin owns its semantic templates. The minting
workflow reads the owning template at the write decision; a copied shape in a
consumer is not authoritative.

## Terminology and migration

Write for a competent junior engineer new to the repository. Define
project-specific or uncommon terms at first meaningful use and state the
actionable implication: what the reader must understand, decide, or do
differently. Add a glossary only when a term repeats across documents and a
local definition would create duplication.

New documents use the canonical paths. When a legacy durable directory
entrypoint is materially touched, rename it to `README.md` atomically with
inbound links, provenance outputs and hashes, generated fixtures, and tests.
Never leave both names as competing authorities. Task implementation state
becomes durable only when stable knowledge is promoted with provenance and
supersession links during completion.
