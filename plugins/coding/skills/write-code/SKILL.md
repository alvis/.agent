---
name: write-code
description: 'Write production-ready code end to end through a TDD lifecycle of design, skeleton, implementation, tests, and refactoring. Use for new functions, features, modules, components, CLI or API endpoints, or approved tickets; route diagnosed failures to fix and explicit production stubs to complete-code.'
model: opus
argument-hint: "<instruction> [--resume]"
---

# Write Code

Before any `jj` decision or command, follow
`coding:references/jj.md`.

Composite orchestrator for the complete TDD lifecycle. It owns phase order,
interactive gates, state reconciliation under an explicit coordinator lease,
and final artifact batching; atomic children own implementation phases. Remove
superseded scaffolding rather than leaving parallel paths or addenda.

## Boundaries

- Use for new functions, features, modules, components, endpoints, or an
  approved specification implemented and tested end to end; use `--resume` for
  a resumed work stream.
- Route skeleton-only work to `coding:draft-code`, accepted production stubs to
  `coding:complete-code`, diagnosed failures to `coding:fix`, green structural
  cleanup to `coding:refactor`, and reviews to `coding:review-code`.
- Reject vague requirements without acceptance criteria or projects without a
  configured test framework.

## Inputs

- Required `<instruction>` with scope, behavior, and acceptance criteria.
- Optional `--resume`; require a resolved work ID/root whose `state.md` defines
  unfinished scope. A missing local root must be resumed through
  `essential:takeover`, never recovered from root continuation files.
- A delegated lifecycle call must include one full executable `task_id` and
  the root state's `plan_source: state.md`. Treat them as assertions against a
  direct reading of `state.md`, never as replacement plan data.
- Internal `--defer-publication` is accepted only from a lifecycle parent that
  passes the exact work ID/root and an explicit history-ownership boundary. It
  keeps this run responsible for its coding review and validation, while the
  parent retains lifecycle review, specification sync, final commit QA, and
  remote publication. Reject this flag on an unowned direct invocation.

## State gate

Before creating or materially rewriting a project artifact, read the absolute
`state.md` path injected by Essential. If unavailable, stop artifact
writes and report the missing contract. Resolve the workspace-local work root,
schemas, lifecycle, and final batch interface before dispatching children.
The caller runs Essential's resolver, asks only on `work_id_required`, handles
`requires_ignore`, and passes the resolved work ID/root with the coordinator
lease. Every delegated child receives that exact ID/root.

This composite requires the caller to grant the sole coordinator lease for
`state/working.md`, `state.md`, and changed lazy overviews. Refuse to start if another
writer retains that lease. Give each child a mission capsule with exact paths;
children read broad work memory only for resume or cross-slice alignment. They
never write leased files and return `generated_files` plus state deltas.

## Composition

Run child skills in this order:

1. `coding:setup-project`, only if essential structure is missing.
2. `coding:draft-code`, for types, skeleton, canonical implementation markers,
   and red/pending test structure.
3. `coding:complete-code`, then `coding:complete-test` for pending tests.
4. `coding:fix` for diagnosed test/type/lint failures; mechanical standards
   route to `coding:lint` and coverage/fixture work to `coding:complete-test`.
5. `coding:refactor` for green behavior-preserving cleanup, then
   `coding:document` when the change affects public behavior, configuration,
   operations, or project documentation promised by the contract.
6. `coding:review-code`, on the predicate in
   [references/WORKFLOW.md](../../references/WORKFLOW.md) — a consequential
   change, a requested review, or a publication gate, which a composite build
   almost always meets; route outstanding findings to `coding:fix` and repeat
   the affected review areas until closed or concretely blocked.
7. `coding:lint`, followed by final focused and full tests, types, coverage,
   and build gates that apply to the repository.
8. Only after those gates, shape local history through `coding:commit`, verify
   it through `coding:finalize-commits`, and publish through `coding:pr create`
   when the stack policy in
   [references/stack-split.md](references/stack-split.md) calls for it.

Pass `--from-composite` only to children that declare it (`setup-project`,
`draft-code`, `fix`, `refactor`). Never pass it to `complete-code` or
`complete-test`.

## Workflow

1. Confirm the coordinator lease, then parse the instruction. Separate user intent, observed facts, inferences,
   accepted reversible assumptions, and unresolved decisions. Resolve material
   unknowns before dependent work. Initialize or refresh the work root and
   `state.md` with the complete goal, plan/lifecycle, criteria, decisions,
   dependencies, blockers, reviews, evidence, promotion, and sync state; link
   `state/working.md`. Use stable three-letter parent IDs and `AAA01`-style child IDs,
   explicit dependencies, and Essential's canonical marked task table. A
   parent with children is a derived roll-up. Read `state.md` (and any
   `state/*.md` children) directly; from the task table determine which
   tasks are runnable, which are blocked, the current owner, and the next
   action, and proceed on that reading — there is no separate validation
   step. A delegated identity must match exactly. Refresh PM-owned `state/working.md` with current focus and fast paths
   only, aiming editorially at 4,096 bytes. Capture immutable `base_rev` before
   any child changes source or history.
2. For `--resume`, read `state/working.md`, `state.md`, and linked artifacts
   directly, and schedule only the runnable executable leaf IDs the task
   table shows. Map the recorded file substate to `draft-code`,
   `complete-code`, `fix`, or `refactor`. Re-read state to resolve any
   contradictions reported by takeover before resuming.
3. Conditionally invoke setup, then invoke each required implementation child
   in composition order. Give it the work ID/root, full `task_id`, canonical
   plan source (`state.md`), and exact relevant paths. Require the same
   identity, attempt outcome, evidence, requested status delta, and an explicit
   `generated_files` manifest in return.
4. After each child, verify its identity, manifest, and evidence; reconcile the
   requested status delta by task ID into `state.md`, refresh `state/working.md`, and
   reconcile any lazy overview whose children changed. Re-read `state.md`
   before scheduling newly ready work. A failed leaf records attempt
   evidence and retry/disposition. The coordinator transitions every affected
   downstream executable leaf to `! blocked` with an `unblock:` action naming
   that retry/disposition; independent branches keep their current/runnable
   state. A material deviation is recorded in
   state and, when it changes task definition, dependency, requiredness,
   target, acceptance mapping, or an approved contract, invalidates the
   downstream closure and review derived from the reconciled task DAG — computed
   by re-reading the reconciled state against the prior version's edges, not from
   any validator or helper — and requires renewed approval. Status-only changes
   need no re-approval.
5. After draft, completion/tests, fix, and refactor, invoke
   `coding:document` when the acceptance map or changed public surface requires
   project documentation. Collect its `generated_files` before offering:
   proceed; rerun the current child with change direction; resume elsewhere;
   or pause through `essential:handover`. Documentation is an artifact writer and
   must finish before code review, lint, final validation, and scoped-manifest
   sealing.
6. Invoke `coding:review-code` against the completed change and pinned work
   contract, on the same predicate step 6 of the child-skill order applies,
   without transferring the pointer/overview coordinator lease. Area
   reviewers write only their assigned files; reconcile their returned roll-up
   into `review.md` here. Route every outstanding finding to its owner, apply
   corrections, and rerun the affected review areas. Require review output to
   reference the same `state.md` plan contract. Do not proceed while
   review closure is outstanding; report a concrete blocker instead of treating
   a displayed verdict as approval.
7. Invoke
   `coding:lint <touched-specifier> --scope=uncommitted --skip-unused`, choosing
   the narrowest project/package specifier containing the touched lifecycle
   paths. The lifecycle run does not authorize project-wide unused-code
   deletion; offer a separate direct `coding:find-unused` or unskipped lint run
   only when the developer explicitly chooses that cleanup. If review
   remediation or lint changes source, rerun the affected focused tests and
   review areas before proceeding.
8. After every artifact writer is finished, deduplicate the combined
   `generated_files` manifest. Select only `.md` paths inside the resolved
   target `.state/`, excluding `state/working.md`, and invoke the Essential
   checker once with `--state-dir <state_root>/.state` when
   eligible paths remain. If it returns `split_required`,
   coordinate one complete split round for all oversized files, preserving
   each original as overview, then run one new batch pass. Never size files
   after each write; paths outside `.state/`, including `docs/**`, are
   not mechanically size-gated.
9. Run the closing gates after review and lint: focused tests for
   every touched slice, then the repository's applicable full tests, types,
   coverage, lint check, and build. Route each failure to its owner, rerun any
   review invalidated by the correction, and repeat the affected gates until
   green or concretely blocked.
10. Apply the history/publication decision last. First inspect only the
   relevant implementation scope against `base_rev` and record `history_state`
   as `dirty`, `saved`, or `none`, including exact dirty paths and clean saved
   unpushed change ids. Dirty relevant paths take precedence when saved changes
   also exist. Reconcile the base diff, acceptance map, and every child
   `generated_files` list into the full publishable lifecycle scope: source,
   tests, project documentation, durable specification/provenance files, and
   deletions. Exclude unrelated user-owned changes and all ignored work state.
   When relevant publication paths are dirty, create and seal the
   checksum-bound scoped-save manifest described by
   `coding:commit`'s
   [manifest workflow](../commit/references/workflow-save-manifest.md): write
   its complete ignored scope request, then invoke
   `coding:commit --prepare-paths-from=<scope-request>` to obtain the immutable
   manifest path/hash without saving history. If any
   path mixes lifecycle and user-owned bytes, the scope is incomplete, or the
   exact dirty subset cannot be isolated, stop `blocked_scope` instead of
   widening the save. <IMPORTANT>Never invoke
   `jj split`, `git commit`, a push, or `gh pr create` directly; history shaping
   belongs to `coding:commit`, isolated commit QA belongs to
   `coding:finalize-commits`, and publication belongs to
   `coding:pr create`.</IMPORTANT> With `--defer-publication`, do not invoke
   `coding:commit --create-pr`, `coding:finalize-commits`, or `coding:pr create`,
   and do not rewrite or restack any published revision. An explicitly assigned
   implementation slice may be saved locally only through
   `coding:commit --paths-from=<manifest> --manifest-sha256=<sha256>`; slice
   commits are optional. Return exactly one deferred terminal to the lifecycle
   parent: `needs_save` with the exact immutable manifest path/hash, selected
   paths, and full scoped invocation when relevant worktree changes remain;
   `ready_for_finalization` only when the relevant tree is clean and saved
   unpushed changes exist; or `no_change` when neither dirty nor saved relevant
   changes exist. Never return an unscoped `/coding:commit` next action. Include
   change ids and exact validation/review evidence when present. The parent
   owns final review, sync, history QA, and publication. Without the flag, any
   dirty save also uses that sealed manifest route before loading the stack
   policy and executing its gated owner handoffs. Any project artifact writer
   after sealing invalidates the manifest and its review/status snapshot;
   return through the applicable documentation/review/validation steps and
   seal a new immutable manifest rather than reusing it.

## Verification

- Tests, types, lint, and the repository coverage target pass; no owned
  implementation or pending-test markers remain.
- `state.md` is internally consistent, contains complete current truth, and
  links current-focus-only `state/working.md`; all lazy indexes match their children.
  Lifecycle `completed` has no unfinished required executable leaf.
- Every child returned a verified `generated_files` manifest and the scoped
  `.state` Markdown gate ran as one batch per pass when applicable.
- Code review, wherever the predicate called for it, preceded lint; final
  tests/types/coverage/build preceded every remote publication; and no
  correction left an invalidated review unstated.
- Commit/push ownership was preserved. A deferred run reports its exact
  `history_state` and `needs_save`, `ready_for_finalization`, or `no_change`
  terminal without a PR or remote mutation. `needs_save` carries a validated
  scoped-save manifest path/hash and exact `coding:commit --paths-from`
  invocation whose publication scope includes every intended lifecycle file
  and no ignored work state; any non-deferred stack dispatch reports its scoped
  save receipt, finalization evidence, and URLs.

## Completion

Report requirements, `task_id`, `plan_source: state.md`,
requested/applied task-status deltas, phases run/skipped, material discoveries, assumptions and
recheck triggers, deviations, decisions, blockers, validation, stack outcome,
work root, and the deduplicated `generated_files` list. For a deferred run,
name the parent owner and return a `publication_deferred` handoff containing
`history_state`, its terminal, and exact next action. For `needs_save`, include
`manifest_path`, `manifest_sha256`, `selected_paths`, and the complete
`/coding:commit --paths-from=<manifest> --manifest-sha256=<sha256>` invocation.
Otherwise, recommend only that same scoped invocation when relevant dirty paths
remain and no stack was dispatched.
