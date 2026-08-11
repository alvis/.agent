---
name: implement-code
description: Execute an approved specification work item from an authoritative local, inline, or Notion-backed contract through delegated coding, review, applicable completion sync, and durable derivation. Use after plan-code approval, when resuming partial work, or when auditing delivered ticket work.
model: opus
argument-hint: "<spec-path-or-ref> [--work-id=<id>] [--source-direction=<direction>] [--transport-root=<dir>] [--transport-profile=<absolute-file>] [--repo=<path>] [--dry-run] [--skip-approval] [--defer-publication]"
---

# Implement Specification

Orchestrate one specification work item. Coding skills own source/test edits;
commit/push skills own history and publication; Specification skills own
contract materialization, MDC authoring, alignment, and completion sync.

## Boundaries

- Do not author the contract directly, perform generic unticketed feature work,
  issue history/publication mutations directly, or hand-edit `.mdc`; after all
  semantic gates, Step 11 delegates those mutations to their Coding owners.
- Consume root `state.md` as the sole canonical plan definition and require its
  `plan_source` to be exactly `state.md`. An explicitly linked
  `state/plan.md` supplies non-authoritative ID-keyed execution
  detail only; never let it define or override task identity or graph fields.
  Do not guess a plan from directory contents.
- Material departures are work-local `changes/<slug>.md` children and PM
  state updates. Contract drift also appears in `reviews/alignment.md`.
- Subagents may write assigned children/evidence but never PM-owned
  `goal.md`, `state/working.md`, `state.md`, `state/journal.md`,
  `state/revisions.md`, overview indexes, or `review.md`.
- A mid-execution surprise — a new restriction, a design or specification
  issue, a failed premise — follows the Essential state-file format's
  change-control procedure: journal it, classify it task-local, plan-level, or
  spec-level, and route it; a spec-level change flows through the canonical
  source (`sync-spec`) before any plan revision.

## Inputs

- **Required**: authoritative specification path/ref.
- **Optional**: work id, source direction, transport root, target repo,
  absolute destination-local transport profile file, `--dry-run`,
  `--skip-approval`, `--defer-publication`, and `--use-cache`.
- **Prerequisites**: resolved active work state and target repository. Notion
  tooling is required only when the selected source/direction uses it.

## Workflow

1. Before creating or materially rewriting a project artifact, read the
   absolute `state.md` path injected by Essential. If unavailable,
   stop artifact writes and report the missing contract. For a direct run, run
   Essential's workspace resolver with `--work-id` only for an explicit user
   override and accept its deterministic environment, Git-branch/jj-workspace,
   or sole-existing-work match. Ask only when it returns `work_id_required`,
   using its returned candidates. A delegated run receives the explicit work
   id/root. Resolve the repository and PM-owned state paths. Read the charter
   `goal.md` when present for the goal, `SC-n` success criteria, and
   specification provenance, then read root
   `state.md` (and any `state/*.md` children) directly; from the task table,
   determine which tasks are runnable, which are blocked, the current owner,
   and the next action, and proceed on that reading — there is no separate
   validation step. Confirm `plan_source: state.md` and retain its exact
   `plan_source`, parent graph, subtask graphs, runnable leaf
   IDs, blocked IDs, and invalidated downstream closure. A malformed graph or
   contradictory lifecycle/task roll-up blocks execution; never guess past it.
2. Resolve the authoritative source/location/direction from the explicit request
   first, then active work state. A raw inline prompt is requirements evidence,
   not an implementation contract. For inline-origin work, require the
   reachable `docs/specs/<capability>/README.md` carrier and durable
   `provenance.json` receipt produced by `spec-code`; compare its current content
   directly against provenance to confirm it matches the approved specification
   content, and return
   `ready_for_specification` if it is absent or mismatched. For an explicit
   local source, preserve its exact path and load the corresponding durable
   derivation/receipt recorded by `spec-code`; never infer a path from its title.
   A reachable `repo:` locator remains authoritative: compare source and
   carrier content directly against provenance, require both to match the
   approved specification content, and
   use the content-derived Git blob oid computed from exact bytes even before
   commit, rather than an unrelated commit oid or index state, as optional
   revision evidence. A missing/moved source, source drift, stale
   provenance, or carrier drift returns `ready_for_specification` even when the
   passed carrier itself is unchanged. For a non-reachable `local-approved:`
   locator, the verified durable carrier is the sole reachable authority and
   the origin content is historical evidence; do not require the ignored origin.
   Only for
   a selected Notion ref requiring work-local materialization, resolve the
   transport profile from explicit `--transport-profile` or an active-state
   mapping containing one destination-local absolute file, logical name, and
   last verified exact-byte SHA-256. Never infer its location from the logical
   name/root or accept an origin path. Invoke `Skill(sync-spec)` with the exact
   transport root and pass the profile explicitly; the child revalidates its
   current bytes and executable. `--use-cache` may reuse the
   work spec only when its receipt matches the requested root `ref:`, all files
   exist, and the recorded content still matches; otherwise refresh. Filename shape is
   never an identity gate. If materialization reports remote change against an
   existing plan/review/implementation, stop with `needs_revalidation` rather
   than continuing from stale intent, and hand the PM the revalidation sweep:
   affected non-done task rows become `! blocked` with
   `unblock: revalidate against <base-id>`, affected `✓ done` rows keep their
   status and gain `validity: stale (revalidate against <base-id>)` plus
   remediation tasks for invalidated closure, charter `SC-n` criteria are
   re-checked against the new base, and the sweep is journaled before
   execution resumes.
3. Read root `state.md` as the canonical plan. Follow an
   explicit implementation-detail link from it only for the assigned task IDs;
   reject detail that duplicates or contradicts root IDs, edges, requiredness,
   targets, or acceptance mappings. Then read the materialization
   receipt, relevant spec sections, and current code required by this ticket.
   Select exactly one mode and load its branch from
   [references/modes.md](references/modes.md): planned execution, iteration,
   draft-required, audit/complete, verify-only, mismatch, or refusal.
4. Build one evidence map from specification requirements to full plan task
   IDs,
   implementation sites, tests, and acceptance evidence. Mark absent, partial,
   implemented, or contradictory behavior.
5. Run an architecture/contract soundness pass. Stop for unresolved material
   decisions. Record an approved contract answer only through the selected
   source owner's authoring path; invoke `Skill(mdc)` only for a Notion-backed
   source whose selected transport owns that MDC. Refresh the source provenance
   and content reference in the work receipt, then re-read the authoritative source
   before coding. Any semantic specification edit invalidates its approval,
   the plan approval, and implementation review until re-confirmed against the
   new content; metadata-only changes (only the `last_edited_time` line) refresh
   the revision evidence without invalidating those semantic gates.
6. Require approval of the exact authoritative specification content
   and approval of the exact task definitions. Marks, runtime status,
   owner, evidence, timestamp, formatting, and derived-diagram changes do not
   alter the plan. A task definition, target, acceptance mapping,
   requiredness, ID, or dependency change does. `--skip-approval` may skip only the additional run
   confirmation for mode, scope, evidence map, and soundness decisions; it
   never bypasses content-approval or publication gates. Record both consumed
   approvals. A mismatch returns `needs_revalidation`; `--dry-run` stops with the
   plan/evidence report and no writes.
7. Capture immutable `base_rev` before dispatch. Prepare PM reconciliation
   entries keyed by full `task_id`; only the coordinator may apply task-status
   transitions to state. Do not edit PM-owned files from children.
8. Execute by capability: when Workflow is available for a code-producing
   mode, load [references/execute-workflow.md](references/execute-workflow.md);
   otherwise use the sequential chain in `references/modes.md`. Schedule only
   leaf IDs returned runnable by Essential: all parent predecessors and all
   declared sibling predecessors must be done. Independent ready leaves may
   run concurrently only when their write scopes do not conflict. Before each dispatch batch, cheaply confirm spec freshness (an `unchanged`
   materialization check for a live source); a changed source stops the batch
   and routes through the revalidation sweep instead of dispatching against
   stale intent. Every
   dispatch receives repo path, work id, exact spec pointers, the charter
   `goal.md` path when present, full `task_id`,
   canonical `plan_source`, acceptance map,
   output-manifest contract, deviation policy, and `--defer-publication` for
   every Coding writer. Task-local commits may be created, but no child may
   push, open/update a PR, restack, or finalize shared history. On
   `pending_decision`, stop, ask, record the answer through the selected source
   owner (`Skill(mdc)` only for the selected Notion-backed path), and resume the
   same run. Each child returns the same task identity, its `capability_id`
   (Essential's `truth.md`), attempt outcome
   (`pass|fail|partial`), evidence, generated files, and a requested status
   delta; reconcile results by ID rather than arrival order, then re-read
   `state.md` to find newly runnable tasks before dispatching them. A failed leaf retains failure
   evidence and retry/disposition. The coordinator transitions every affected
   downstream executable leaf to `! blocked` and records an `unblock:` action
   naming the failed task's retry or disposition; independent branches keep
   their current/runnable state. After all code-producing tasks converge, require
   project-documentation coverage from the Coding result. If an applicable
   public behavior, configuration, operations, or developer-workflow change
   has no completed documentation child, invoke `Skill(coding:document)` over
   the exact touched project scope and collect its `generated_files`. It must
   finish before Step 9 review; do not run it after the scoped-save manifest is
   sealed.
9. Re-run the Step 2 source/carrier authority and direct content comparison after coding;
   source drift returns `ready_for_specification` and invalidates the plan/code
   alignment before review. Invoke `Skill(review-implementation)` with the work
   id, a reference to the exact current specification content, canonical `plan_source`,
   and, for a Notion source, the
   same exact transport root/profile file. Retry P0/P1 alignment fixes at most three passes;
   general and security review run every pass. Then run the usage trace in
   [references/thought-experiment.md](references/thought-experiment.md). A
   review is usable only when it was performed against the current specification
   content, confirmed by direct comparison, and against the current task
   definitions; a definition change requires re-review.
10. Use the selected source's owning completion path. For every Notion-backed
    source, whether or not local specification content changed, invoke
    `Skill(sync-spec)` in `complete --stage=implementation` mode with the same
    exact `--transport-profile=<absolute-file>` before code
    publication and require outbound verification, refreshed selected mirror,
    regenerated versioned spec,
    derivation receipt, and dependent revalidation results before
    `completed`. A `status: success`, `classification: metadata_only` result
    refreshes the exact base/receipt but
    retains semantic approvals only when the content is otherwise identical.
    If completion returns `status: success`, either
    `classification: remote_only` or `classification: structural_change`, and
    `next_action: revalidate`, do not
    reread stale L: invoke `Skill(sync-spec)` with that profile in `materialize`
    mode (or its
    equivalent safe clean-L promotion), require atomic promotion of verified R
    plus a new immutable base/receipt, and only then return to Step 3 against
    that refreshed contract. If it returns
    `status: success`, `classification: concurrent`, and
    `next_action: specification_reconciliation`, do
    not promote either side, reread stale L, or push merged proposal M from the
    implementation stage. Route the B/L/R packet and immutable M proposal to
    the PM/user source owner. After explicit resolution, the owner may apply M
    only through the specification authoring path (`Skill(mdc)` for Notion),
    then must obtain specification
    approval of M's exact content. Invoke
    `Skill(sync-spec)` with that profile in
    `complete --stage=specification`; require guarded
    publication, independent verification pull, and a new immutable
    base/receipt. Then invoke `Skill(sync-spec)` with that profile in
    `materialize` mode and
    require the new exact base content in L before continuing. Preserve the old
    root state, then read the new root state directly against the preserved
    old state to determine what changed after replanning.
    Invalidate the old plan
    approval, the affected task results/downstream closure,
    implementation alignment, review, usage trace, and the review's content
    binding; restart from Step 3, replan/reapprove, reimplement or
    remediate, rereview, rerun usage tracing, and rerun implementation
    completion. No implementation-stage push of unreviewed M is allowed. Any
    final content that differs from the reviewed content likewise blocks
    publication and requires contract and plan reapproval followed by review
    and usage tracing. For a
    local/inline-origin source, repeat the Step 2 authority check immediately
    before accepting completion; require the current durable
    carrier and provenance receipt to map the exact reviewed content back
    to its explicit local path or approved inline candidate. Refresh the
    content-preserving derivation when necessary and do not claim a Notion
    round trip. After review, usage tracing, and completion sync have converged,
    reconcile any `reference.md` one final time. Specification is its sole
    writer: verify every declared consumer API against repository-relative
    implementation paths; keep `**Status:** 🚧 Pending` until the whole surface
    is implemented, otherwise use
    `**Status:** ✅ Implemented (<paths>, <paths>)`. Update its logical-unit mapping
    and exact output hash in `provenance.json`, refresh the external
    provenance-file hash, re-run the source/carrier/provenance checks, and
    include both materially changed files in `generated_files`.
11. Only after review/usage, durable derivation, and applicable completion sync
    are stable at one exact specification content may history finalization or
    publication begin. Inspect relevant repository state against `base_rev` and
    record `history_state` with relevant dirty paths, clean saved unpushed
    changes, and any already-published boundary. Relevant dirty paths take
    precedence over saved changes when choosing the terminal. Reconcile the
    base diff and every child `generated_files` list into the full intended
    publication scope, including source, tests, project docs, durable local or
    Notion-derived specification carriers, provenance receipts, and deletions;
    exclude unrelated user-owned changes and every ignored work-state/evidence
    file. For dirty publication paths, create the immutable checksum-bound
    scoped-save manifest required by `coding:commit`'s
    `--paths-from=<manifest> --manifest-sha256=<sha256>` route: write the
    complete ignored scope request and invoke
    `Skill(coding:commit --prepare-paths-from=<scope-request>)`, which must
    return without history mutation. Its selected paths are exactly the dirty
    publication subset and its exclusion inventory preserves every other dirty
    byte/status entry. If the scope is incomplete,
    one selected path mixes lifecycle and user edits, or isolation cannot be
    proved, stop `blocked_scope` and do not offer a broader commit. With public
    `--defer-publication`, do not load a publication path and return exactly one
    terminal:
    - `needs_save` when any relevant worktree change remains dirty, with exact
      manifest path/hash, selected paths, and the complete
      `/coding:commit --paths-from=<manifest> --manifest-sha256=<sha256>` next
      action;
    - `ready_for_finalization` only when the worktree is clean and saved
      unpushed commits/changes exist, with final commit QA and publication as
      next actions; or
    - `no_change` when neither relevant dirty changes nor saved unpushed
      commits/changes exist.
    Without `--defer-publication`, return `no_change` for the same empty case;
    otherwise load [references/stack-aware-sizing.md](references/stack-aware-sizing.md),
    passing the same manifest path/hash so it saves only the selected dirty
    scope before final commit QA, then delegates publication to its Coding
    owner. Any project artifact writer after manifest sealing invalidates that
    manifest, review/status snapshot, and final verification; return through
    the owning Step 8 writer and Steps 9–10, then seal a new immutable manifest.
12. Read root `state.md` (and any `state/*.md` children) directly to derive the
    terminal lifecycle from the task table; there is no separate validation step.
    Lifecycle `completed` holds only when every required executable leaf is
    `done`; otherwise return `active` when work is runnable or `blocked` when
    unfinished required work has no runnable leaf. Collect every child
    `generated_files` manifest, deduplicate it, and
    return it to the PM with ID-keyed task deltas and
    state/overview/review reconciliation payloads. Never run
    file sizing; after all writers return, the PM checks only eligible work
    Markdown inside the target `.state/`.

## Verification

- Materialization identity/content held before coding and every acceptance item
  has implementation/test evidence or a named gap.
- `base_rev` predates all children; history/publication stayed with Coding.
- No remote publication occurred before content-bound review, usage tracing, and
  the applicable completion/revalidation loop finished.
- A remote-only completion refreshed L atomically from verified R before any
  restart. Concurrent implementation completion returned `status: success`,
  `classification: concurrent`, and
  `next_action: specification_reconciliation`; M passed specification-stage
  approval/publication/verification/new-base/materialization before invalidated
  plan/code/review work was repeated.
- Public `--defer-publication` returned `needs_save`,
  `ready_for_finalization`, or `no_change` according to recorded
  `history_state`, with no remote history mutation; `needs_save` includes the
  exact scoped-save manifest path/hash/invocation, its publication scope
  contains every intended lifecycle-generated source/test/doc/spec/provenance
  file and no ignored work state, and child writers always deferred
  publication in either mode. Non-deferred dirty work used the same scoped
  route before final commit QA.
- Every material departure has evidence, disposition, and remaining-plan
  revalidation in a work-local change child. A definition-changing departure
  invalidated the affected downstream closure and
  obtained renewed plan approval; a status-only update retained approval.
- Alignment, correctness/general, and security evidence exist. Contract changes
  completed the selected source owner's verification and derivation path;
  Notion-backed sources completed a verified round trip, while local/inline
  sources did not claim one.
- No child wrote PM-owned files or MDC; collected `generated_files` is complete.

## Completion

Report deterministic operational status plus sync `classification` and
`next_action` (including `specification_reconciliation` when applicable),
ticket/stage/mode, work and spec receipt paths,
validated transport profile path/exact-byte SHA when applicable,
the reviewed specification content reference and observed revision,
repo/base rev, `plan_source: state.md`, parent/per-parent
graphs, runnable/blocked/invalidated task IDs, acceptance coverage, decisions,
dispatched task IDs/children/commits, attempt results and task-status deltas, departures,
review/usage verdicts, completion-sync/derivation/revalidation result, PM
reconciliation payload, the `needs_save`/`ready_for_finalization`/`no_change`
history terminal or publication result, explicit `history_state`, scoped-save
manifest path/hash/invocation and preservation receipt when applicable, next
actions, and `generated_files`.
