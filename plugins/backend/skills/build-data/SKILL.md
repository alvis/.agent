---
name: build-data
description: Build or extend a data orchestrator from an approved work-local specification through schema, operations, controller integration, tests, canonical review, and handoff. Use for new data domains, operations, or Prisma schemas; keep audits in audit-data.
model: opus
argument-hint: "<domain-name> <operations...> [--work-id=<id>] [--spec=<path-or-ref>] [--extend] [--notion-url=...]"
---

# Build Data

Own the implementation lifecycle for `@theriety/data-{domain}` while treating
the work-local specification and PM state as coordination boundaries.

## Boundaries and inputs

- Require domain and operations/entities. A work id is optional for direct runs.
  Validate verb contracts and package prerequisites. Optional extend mode,
  local/remote specification source (`--notion-url` remains a compatibility
  alias), and selector pattern remain supported.
- Do not build services or audit existing data layers.
- Workers may edit assigned source/tests and work-local child artifacts only;
  they never edit `state/working.md`, `state.md`, or overview indexes.

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
   exact receipt paths and refs. Detect new/extend mode, validate dependencies/
   verbs, read existing surfaces, choose selector pattern (`simple` up to three
   entities, otherwise `complex`), and produce an implementation manifest tied
   to acceptance criteria.
3. Dispatch one schema owner with
   [references/schema-implementation.md](references/schema-implementation.md).
   Proceed only when Prisma generation and package build pass.
4. In new mode, run `coding:setup-project` for the established data-package
   structure. Draft typed operation signatures, selectors, exports, and
   controller wiring once through `coding:draft-code`; bodies belong only to
   the implementation step.
5. Dispatch related operation batches (maximum three) using
   [references/operation-implementation.md](references/operation-implementation.md),
   then one controller integration owner. Every child receives the Essential
   contract path, work/spec pointers, acceptance slice, and manifest contract.
6. Run Coding fix/lint/refactor and the package's exact typecheck/lint/test
   gates. Run `coding:review-code` for the assigned canonical `reviews/` areas;
   each reviewer writes only its area file and returns counts/deltas. Return
   those to the PM/coordinator for sole-writer `review.md` reconciliation, and
   loop findings through the owning fix step within bounded retries.
7. For any material implementation departure, create a lowercase
   `changes/<slug>.md` child with evidence/disposition and return PM
   reconciliation for `changes.md`/`state.md`. Contract drift also routes to
   `reviews/alignment.md`; do not create a deviations log.
8. Commit through `coding:commit` after approval. When incomplete, return a
   pause request with the unfinished scope and next action to the PM, which
   alone may invoke `essential:handover`. Collect child manifests, deduplicate, and return
   explicit final paths generated or materially rewritten as
`generated_files`. Do not run file sizing; the PM checks only eligible work
Markdown inside the target `.state/`.

## Verification

- Prisma generation and package typecheck/lint/tests pass; every requested
  operation is implemented, integration-tested, and exposed by the controller.
- Canonical area details and returned review reconciliation agree with no
  unreported blocker.
- Spec refs/acceptance mappings and material departures are traceable.
- No worker edited PM-owned files; reconciliation and `generated_files` are
  complete.

## Completion

Report work/spec receipt, mode, package, entities/selectors/operations, gates,
canonical review result, commit/handover, departures, PM reconciliation, and
`generated_files`.
