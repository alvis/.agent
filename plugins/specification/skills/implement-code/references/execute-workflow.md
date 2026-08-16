# Execution mechanisms

The parent selects deterministic scripted execution for independent code-producing slices and a
sequential Coding chain otherwise. The orchestrator does not edit source or
history.

## Shared dispatch contract

Each child receives absolute repository/work paths, exact specification refs
and headings, one full executable `task_id`, canonical `plan_source`, acceptance
criteria, deviation policy, and the Essential output-manifest rule. Coding
agents treat work-spec transport bodies as read-only.
Architectural uncertainty returns `pending_decision`; only the orchestrator may
ask and route the answer through the selected source owner. For a Notion-backed
path, use only the exact `body_author` explicitly bound by the parent.
Every code-producing child receives `--defer-publication`. It may create a
slice-local commit through `coding:commit`, but must not pass `--create-pr`, run
`coding:pr create`, restack, or otherwise publish before the parent review/sync
gate.

## Parallel-execution mechanism

1. Read root `state.md` (and any `state/*.md` children) directly and
   determine `runnable_leaf_task_ids` from the task table. Parent tasks are
   roll-ups. All parent predecessors and sibling dependencies must be done;
   table order is never scheduling authority.
2. Fan out ready leaves whose write scopes do not conflict. Each runs its mode-appropriate Coding writer
   with deferred publication, its bounded slice review/fix loop (maximum three),
   then local-only `coding:commit` on success.
3. Give each landed task to an independent adversarial verifier. Accept only
   when no verifier can refute its cited requirement/criterion.
4. Reconcile child results by exact task ID, never completion order. Require the
   unchanged task definitions, `pass|fail|partial` attempt outcome, evidence,
   generated files, and requested status delta. Requeue a refuted task with
   evidence. For a failed leaf, the coordinator marks every downstream
   executable leaf `! blocked` with an `unblock:` action tied to that failure's
   retry/disposition; independent branches retain their current/runnable state.
   Re-read root state directly before each dispatch
   wave. Stop on a decision or iteration/token guard; never silently downgrade
   or continue stale work.

```yaml
plan_source: state.md
verified_task_ids: []
pending_decisions:
  - {task_id: '', spec_loc: '', question: '', options: [], rationale: ''}
local_commits: [{sha: '', message: '', published: false}]
child_dispatch_log: [{task_id: '', skill: '', attempt: pass|fail|partial, requested_status: planned|working|done|failed|blocked|cancelled, evidence: [], summary: ''}]
invalidated_downstream_closure: []
generated_files: []
departures: []
unresolved: []
```

On a pending decision, record the answer through the selected source owner
(the bound `body_author` for a Notion-backed path), update the work receipt hash, and resume
the same run so completed tasks remain cached when both the specification and
task definitions are unchanged.

The parent owns the full alignment/general/security review, usage trace,
Notion completion/revalidation loop, and only then final history/publication.

## Sequential mechanism

Run the selected chain from `modes.md` in the live session. Apply the same
decision stop, deferred-publication rule, deviation reporting, three-pass slice
review bound, and manifest collection. Do not write PM-owned overview/state
files or invoke a publication path.
