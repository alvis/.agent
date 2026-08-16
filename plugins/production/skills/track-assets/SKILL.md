---
name: track-assets
description: Create or maintain the versioned asset and render manifest for a production work stream — register source assets with content hashes and rights, record every render with its exact inputs and settings, and mark stale entries when a decision invalidates them. Use when footage, audio, graphics, fonts, or a new render/export needs durable identity; this skill writes manifests, never media bytes.
requirements:
  intelligence: low
argument-hint: "[manifest-path] [--work-id=<id>]"
---

# Track Assets

Maintain a text manifest that gives every media asset and render a stable
identity, exact provenance, and rights status, so "reproduce render v12" is an
operation and an approval can bind to one exact revision. Media bytes stay
outside Git; their identity and lineage do not.

## Boundaries

- Use for registering assets, recording renders/exports, updating rights or
  delivery state, and marking validity after an invalidating decision.
- Do not edit, move, or delete media files; do not perform review or approval
  (`production:review-render`), and do not manage work-stream state
  (Essential owns the lifecycle).
- Never invent a hash, duration, or rights fact — record only observed values
  and mark the rest as pending verification.

## State gate

Before creating or materially rewriting a project artifact, read the absolute
`state.md` path injected by Essential; if unavailable, stop
artifact writes and report the missing contract. Then read Essential's
`${ESSENTIAL_ROOT}/templates/docs/docs-root-readme.template.md`,
`${ESSENTIAL_ROOT}/templates/docs/domain-readme.template.md`, and
`${ESSENTIAL_ROOT}/templates/docs/domain-item-readme.template.md`, using the
root derived from the injected state contract. Read Production's
[asset manifest template](../../templates/asset-manifest.template.md) for the
semantic shape, and
Essential's `anchors.md` reference (anchor declarations). The manifest is a
durable versioned document under the contract's plugin-owned
`docs/<domain>/<slug>/` clause: default location
`docs/production/<deliverable-slug>/assets.md` unless the work stream's
charter names another. Every manifest write ensures
`docs/production/README.md` and
`docs/production/<deliverable-slug>/README.md` exist, reconciles
`docs/README.md`, and maps the item reader to `assets.md` as semantic
authority. Work-local exploration stays under the stream's `.state/` per the
contract.

## Workflow

1. Resolve the manifest: the given path, the charter's declared manifest, or
   propose the default location for user confirmation. Read it fully when it
   exists; never regenerate it from scratch over an existing file. Create a
   missing domain or item README even for an existing semantic manifest; update
   an existing README only when its navigation or authority map changes.
2. For each asset to register or update: record the stable id (never renamed
   or reused), kind, store locator, content hash (`sha256sum` when the bytes
   are reachable; otherwise `pending`), observed technical facts, provenance
   inputs by id and revision for derived assets, and rights (owner, consent,
   licence, expiry). Ask the user rather than guessing a rights fact.
3. For each render: add a **new entry per revision** — an entry is history and
   is never edited into its successor. Record the timeline/project revision,
   the hash of the assets section it was built from, render settings (preset,
   fonts, LUTs, plugins, templates), output hash, and delivery destination.
4. When a decision invalidates an asset or render, append
   `validity: stale (<decision-id>)` to that entry and leave it in place;
   record which entries the decision `preserves` untouched. Never delete an
   entry that any render or approval references.
5. Return the manifest path and a summary of entries added, updated, and
   marked stale. `generated_files` includes `assets.md` plus every
   created/materially rewritten root, domain, or item README; do not list
   unchanged paths. Report hashes still `pending` so the next session can
   complete them.

## Verification

- Every derived asset and every render names the exact inputs (id + revision
  or hash) it was built from; no entry was renamed, reused, or deleted.
- Rights fields are observed or user-confirmed, never invented; expiries and
  consent refs are present or explicitly null.
- Stale entries kept their history and name the invalidating decision.

## Completion

Report the manifest path, entry counts by disposition (added / updated /
stale-marked / pending-hash), and complete `generated_files`, including every
created/materially rewritten README floor.
