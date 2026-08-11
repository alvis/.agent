---
name: build-service
description: Build or extend a backend service from an approved work-local specification through manifests, implementation, tests, canonical review, and handoff. Use for new services, operations, integrations, webhooks, or manifest schemas; keep audits in audit-service.
model: opus
argument-hint: "<service-name> <operations...> [--work-id=<id>] [--spec=<path-or-ref>] [--extend] [--notion-url=...]"
---

# Build Service

Own a service implementation lifecycle while consuming the active work
specification and preserving PM-owned coordination state.

## Boundaries and inputs

- Require service and operation descriptions. A work id is optional for direct
  runs. Optional data domain, integrations, peers, webhooks, guards, extend
  mode, and local/remote specification source (`--notion-url` remains a
  compatibility alias) remain supported.
- Do not build data packages, perform audit-only work, or invent an unresolved
  contract.
- Workers edit assigned source/tests and child evidence only, never
  `state/working.md`, `state.md`, or overview indexes.

## Workflow

1. Before creating or materially rewriting a project artifact, read the
   absolute `state.md` path injected by Essential. If unavailable,
   stop artifact writes and report the missing contract. For a direct run, run
   Essential's workspace resolver with `--work-id` only for an explicit user
   override and accept its deterministic environment, Git-branch/jj-workspace,
   or sole-existing-work match. Ask only when it returns `work_id_required`,
   using its returned candidates; any new id follows that user-confirmed choice.
   A delegated run receives the explicit work id/root. Read only the exact
   plan/spec pointers required by this build.
2. Resolve specification context from an explicit user-supplied path, ref, or
   inline contract first, then the active work-state pointer. Use local or inline
   sources directly. Only when the selected source is a Notion ref and local
   materialization is required invoke `specification:sync-spec`, preserving its
   exact receipt/frontmatter identity. Resolve new/extend mode, packages,
   operations, dependencies, and acceptance mappings; stop on ambiguity or a
   missing data dependency.
3. Declare missing manifests using
   [references/manifest-declaration.md](references/manifest-declaration.md), at
   most three independent operations concurrently. Each child receives the
   Essential contract path, work/spec pointers, acceptance slice, and output
   manifest contract. Proceed only when schemas compile.
4. Scaffold new packages through `coding:setup-project`, then run the sequential
   draft/complete/test owners with context from
   [references/implementation-patterns.md](references/implementation-patterns.md).
5. Run Coding fix (maximum three cycles), lint, refactor, and exact package
   typecheck/lint/test gates. Run `coding:review-code` for assigned canonical
   work-local review areas; each reviewer writes only its area file and returns
   counts/deltas. Return them to the PM/coordinator for sole-writer `review.md`
   reconciliation; findings return to their owning fix.
6. Record material departures in lowercase work-local change children, return
   PM reconciliation for `changes.md`/`state.md`, and route contract drift to
   alignment. Do not create a standalone deviations file.
7. Commit through `coding:commit` after approval. When incomplete, return a
   pause request with the unfinished scope and next action to the PM, which
   alone may invoke `essential:handover`. Collect/deduplicate child manifests and return
   explicit final paths generated or materially rewritten as `generated_files`.
   Do not run file sizing; the PM checks only eligible work Markdown inside the
   target `.state/`.

## Verification

- Service and any manifest package pass typecheck/lint/tests; every operation is
  declared, registered, implemented, and covered by required tests.
- Canonical review detail and returned reconciliation agree with no hidden
  blocker.
- Contract refs, acceptance evidence, and departures are traceable.
- No worker wrote PM-owned files; reconciliation and `generated_files` are
  complete.

## Completion

Report work/spec receipt, mode, package/manifest paths, operations,
integrations/webhooks, gates, review, commit/handover, departures, PM
reconciliation, and `generated_files`.
