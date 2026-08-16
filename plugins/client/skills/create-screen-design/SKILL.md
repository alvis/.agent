---
name: create-screen-design
description: Create a new responsive screen-design contract from user-selected product and specification context, keep temporary exploration in the active work item, synchronize approved content through an explicitly selected body author and Notion transport, and promote durable design docs. Route existing screens to update-screen-design.
metadata:
  intelligence: high
argument-hint: "<product> <screen descriptions...> [--work-id=<id>] [--context=<path-or-ref>] [--context-direction=<direction>] [--transport-root=<dir>] [--transport-profile=<absolute-file>] [--body-author=<plugin:skill>] [--template-ref=<ref>] [--parent-ref=<ref>] [--collection-ref=<ref>] [--constraints=...] [--platforms=...]"
---

# Create Screen Design

Create new screen design without conflating ignored Notion transport,
task-specific design exploration, and durable versioned design knowledge.

## Boundaries

- Use for new UX contracts, layouts, responsive behavior, interaction states,
  accessibility, and handoff notes. Existing pages route to
  `update-screen-design`; implementation/rendered review stays with Web owners.
- Temporary detail lives in
  `.state/works/<work-id>/design/<slug>.md`; `design.md` is the
  PM-owned overview. Do not create an independent design artifact elsewhere.
- Notion transport bodies are opaque here. This plugin ships no body grammar or
  body-authoring skill. Before semantic body creation or change, require the
  exact external `--body-author=<plugin:skill>` selected by the caller and pass
  it unchanged through the selected transport operation. Do not choose/derive
  filenames or size-gate transport files.
- Durable feature/screen design promotes to `docs/design/<slug>.md`; only truly
  system-wide tokens/components/states/motion/accessibility update
  `docs/design/system.md` or its children.

## Inputs

- **Required**: product and screen descriptions.
- **Optional**: work id, constraints, platforms (default web + mobile), and an
  explicit context source, materialization direction, local transport root,
  and transport profile.
- **Required for a Notion-backed creation**: explicit template, parent, and
  collection refs plus one canonical `--body-author=<plugin:skill>` matching
  `^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$` and an absolute transport profile.
  This marketplace supplies no defaults.
- **Prerequisites**: resolvable product/context, Notion credentials/tooling,
  and an active work stream.

For a direct run, run Essential's workspace resolver, passing `--work-id` only
when the user supplied an explicit override. Accept its deterministic
environment, Git-branch/jj-workspace, or sole-existing-work match. Ask the user
only when it returns `work_id_required`, using its returned candidates; never
invent an id. A delegated run receives the explicit work id and root.

## Workflow

1. Before creating or materially rewriting a project artifact, read the
   absolute `state.md` path injected by Essential. If unavailable,
   stop artifact writes and report the missing contract. Use the workspace
   resolver result as the active work root. Read only the work pointers and
   spec/design sources required for this screen-design assignment.
2. Materialize required product/spec context from the source, location, and
   direction supplied by the user or active work state. Use local or inline
   context directly. For a remote source, invoke
   `specification:sync-notion` in `notion-to-local` mode with the explicit
   transport profile and preserve every returned path and ref. Never assume a
   synchronization skill, body author, template/parent/collection ref, default
   mirror, or fixed transport directory. Pull the caller-selected live screen
   template into the explicitly selected transport root. Search for
   collisions; existing screens route to update.
3. Map each requested screen to product relation, source refs, constraints, and
   platform coverage. Create a lowercase work-local design child with purpose,
   audience/task, hierarchy/navigation, responsive behavior, loading/empty/
   error states, accessibility, distinct alternatives/rationale, decisions,
   implementation notes, and provenance.
4. Present alternatives and obtain approval. Return the child row/status to the
   PM for `design.md`/`state.md` reconciliation; do not edit those overview
   files directly.
5. For each approved screen, require an explicit local unsynced transport path
   from the caller or selected transport; never synthesize it from the title or
   id. Resolve and validate `body_author` once, record
   `selection_source: explicit_argument|delegated_caller`, and invoke that exact
   capability only with the approved body and exact path. Apply the explicitly
   supplied template, parent, and collection refs without substituting a
   built-in value. Then invoke `specification:sync-notion` in
   `local-to-notion` mode with the exact transport profile and identical
   body-author selector. Accept the canonical ref only from the validated create
   output, then verification-pull that identity into staging. Only after the
   staged identity and body match may `specification:sync-notion` advance the
   canonical local metadata and receipt. Never expect an external executable to
   rewrite the source file in place. Verify the unchanged selector before
   attempting another screen.
6. Promote stable non-system design to `docs/design/<screen-slug>.md` with
   Notion ids, source revision/hash, approved decision links, and supersession
   metadata. Route any system-wide rules to `docs/design/system.md` without
   duplicating them in the screen doc. Read
   `${ESSENTIAL_ROOT}/templates/docs/docs-root-readme.template.md` and
   `${ESSENTIAL_ROOT}/templates/docs/design-readme.template.md`, using the root
   derived from the injected state contract, then update
   `docs/README.md` and `docs/design/README.md` links when needed.
7. Verify each remote page through the selected transport's diff or verification
   pull into an explicit verification location, and verify the durable
   derivation against that source. Stop on uncertain creation to avoid
   duplicates.
8. Return explicit final paths generated or materially rewritten as
`generated_files`, plus PM reconciliation. Do not run file sizing; after all
writers finish, the PM checks only eligible work Markdown inside the target
`.state/`.

## Verification

- Each screen has one unambiguous remote ref with canonical parent/product
  relations and complete responsive/state/accessibility coverage.
- Work design remains temporary and lower-case; durable promotion is approved,
  versioned, linked, and provenance-backed.
- No transport path was invented or body-edited outside the explicitly selected
  body-author capability; no worker edited PM-owned files.
- `generated_files` includes every work/durable/transport path changed.

## Completion

Return status, caller-supplied template/parent/collection refs, body-author
capability and selection source, work/spec sources, per-screen temporary
design, remote ref/verification, durable promotion/system-rule routing, PM
reconciliation, unattempted recovery, and `generated_files`.
