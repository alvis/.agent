---
name: cleanup
description: Audit and safely retire stale development state across git branches, registered Git worktrees, jj workspaces, and the centralized state root. Use for /cleanup or abandoned-work audits; require evidence, the three-day landing window, recoverable backup, and per-target approval before removal or permanent archival.
requirements:
  intelligence: high
argument-hint: "[path] [--exclude-remote]"
---

# Cleanup

Before any `jj` decision or command, follow
`coding:references/jj.md`.

Own evidence-first cleanup of no-longer-needed development state: branches,
registered worktrees/workspaces, jj changes, and the resolved state root's ignored
`.state/works/<work-id>/` directories. Inventory first, preserve ambiguity,
and remove only individually approved, recoverably backed-up eligible targets.

## Boundaries

- Audit stale or divergent git/jj state and centralized work state.
- Do not perform source dead-code removal, linting, PR authoring, or history
  rewriting. History mutations remain owned by `coding:commit`.
- Never discover workspaces by scanning sibling or `~/.workspaces/` directories.
  Registered Git and jj paths scope the VCS audit only. Resolve state once from
  the Essential `state_root` contract; never look for per-workspace state copies.
- Age alone, a merged branch, or a directory named “complete” never authorizes
  state archival. Active, interrupted, or ambiguous work is
  preserved.

## Inputs

- Optional target path; otherwise use the current repository/workspace.
- `--exclude-remote` skips remote fetch, remote branch deletion candidates,
  and PR metadata checks.
- Missing `jj`, `gh`, network, or credentials does not abort local inventory;
  mark the affected evidence partial and downgrade recommendations.

## State contract

Before resolving state paths, read the absolute
`state.md` path injected by Essential. If unavailable, do not
classify or remove `.state/works/`; report the missing contract and
continue only the traditional git/jj audit when useful. Cleanup reads final
promotion records but does not create or rewrite them, `state/working.md`,
`state.md`, or overview files. It makes no durable `docs/` write of its own.
Backup metadata
lives only in the OS temporary backup tree.

## Workflow

1. **Resolve repository evidence.** Resolve Git and jj roots from the target,
   record mismatches, and identify the default branch from `origin/HEAD`, then
   `main`, then `master`. Fetch only with already-available authorization and
   unless `--exclude-remote`; otherwise mark remote evidence stale.
2. **Inventory version-control state without deletion.**
   - Git branches and remotes: tips, dates, upstreams, merged/unmerged status,
     unpushed commits, and patch/tree equivalence.
   - Git worktrees: parse `git worktree list --porcelain`; for every registered
     local path record HEAD, branch, lock/prunable state, dirty/untracked files,
     and stashes.
   - jj: record mutable/divergent changes and paths/names returned by the
     installed version's workspace-listing commands. Include only explicitly
     registered local workspaces; an entry whose path cannot be resolved is a
     partial finding, not permission to scan or guess.
   - PRs when authorized: state, merge/close time, base/head, checks, and
     whether commits are present on the default branch.
3. **Inventory centralized state.** Resolve one `state_root` from the Essential
   state contract and enumerate only `state_root/.state/works/*`. For each work
   directory record:
   - state-root identity and the recorded `Location` of its source checkout;
   - work ID/path, `state/working.md` and `state.md` presence, lifecycle status,
     owner, goal, repository revision, completion timestamp, and blockers;
   - `review.md` plus the seven review-area dispositions;
   - durable architecture/design/spec promotion paths and receipts;
   - Notion source identity and completion receipt: outbound push, conflict
     dispositions, verification pull, and zero unexpected diff;
   - promoted `docs/` paths and the work directory's own final state;
   - applicable landing evidence and timestamps for every closure gate.

   Read `state/working.md` first for navigation, then verify all retirement evidence
   from `state.md` and its exact links. Read `state.md` (and any `state/*.md`
   children) directly for every candidate and record lifecycle status,
   canonical `plan_source: state.md`, status counts, runnable/blocked task
   IDs, and any inconsistency. State that is malformed, contradictory, or
   otherwise unreadable makes the candidate ambiguous and ineligible; cleanup
   never migrates it. Filesystem modification time is only a
   clue; it never substitutes for lifecycle or promotion timestamps. Recorded
   source-checkout locations never change where cleanup reads work state.
4. **Classify lifecycle independently of cleanup eligibility.**
   - **Active**: state says active/in progress, has a live current focus, open
     implementation, or current branch/PR activity.
   - **Interrupted**: unfinished work is paused or blocked and has a recorded
     next action.
   - **Completed**: the lifecycle state in `state.md` reads `completed`, every
     required executable leaf is `done`, no required leaf is planned/working/failed/
     blocked, and the applicable landing evidence plus repository revision are
     coherent. Coding work requires a merge or default-branch revision;
     non-coding work requires explicit acceptance and a promotion receipt. A prose
     label or lifecycle field the task table does not bear out is not completion.
     An independently unresolved named blocker or open question does not change
     the completed phase, but it prevents archival under the retirement gate.
   - **Ambiguous**: state is missing/malformed/contradictory, owner, revision,
     or resolved `state_root` identity is unclear, or authoritative evidence cannot
     establish one of the prior classes. Preserve it.
5. **Apply the state retirement gate.** A completed centralized work
   directory is `recommend archive` only when every condition is evidenced:
   - a direct reading of `state.md` shows every required executable leaf
     terminal `done`, with no unresolved contradiction against the task table;
     `cancelled` required scope is acceptable only when the approved current
     plan definition removed its requiredness;
   - all seven reviews agree with `review.md`; its disposition counts derive to
     zero outstanding findings, so no `open`, `deferred`, or malformed risk
     disposition remains. Every `fixed` finding has verified closing evidence.
     Every `acknowledged` or `skipped` finding has non-placeholder rationale, an
     accountable owner, and an explicit recheck condition; P0/P1 also has
     explicit risk-acceptance authority and durable evidence. Malformed entries
     remain outstanding and make the work ineligible for retirement;
   - durable promotion is complete, or explicitly not required with evidence;
   - Notion-backed work has a verified outbound/merge/re-pull/zero-diff
     completion receipt; non-Notion work is explicitly evidenced as such;
   - every stable durable fact is promoted to its authoritative destination and
     the promotion receipt lists those paths, or evidences `not required`; when
     repository documentation is the durable form, its work ID and revision
     match the work directory's final state;
   - no named blocker or open question remains. It must be answered, or its
     responsibility must be transferred to a named durable carrier that
     outlives the stream, remains discoverable, and is recorded in the
     completion receipt; in either case clear the blocker from the stream
     before archival;
   - the applicable landing evidence is recorded: coding work is merged or
     present on the default branch; non-coding work has explicit acceptance and
     a promotion receipt listing every durable promoted path or evidenced
     `not required`;
   - at least three days have elapsed since that landing evidence.
     `retirement_ready_at` is exactly the landing-evidence timestamp plus this
     fixed three-day window; landing age is measured from the same timestamp.
     The window gives observers time to see the landing settle while keeping
     the live index focused; no later deletion window follows it.

   A missing/inaccessible gate or a completed stream with a named blocker/open
   question yields `needs review` and is not archivable. Active, interrupted,
   and ambiguous work yields `do not archive`. Never recommend archival merely
   because the directory is old or its branch merged, and never bury an
   operator question by removing its overview row.
6. **Classify traditional VCS candidates.** Recommend cleanup only for merged
   or content-equivalent state whose retained copy is proven. Mark closed but
   unmerged PRs, dirty worktrees, divergent jj state, stale remote evidence,
   and uncertain ownership `needs review`. Protect default/release branches,
   open PRs, unpushed commits, and unbacked changes.
7. **Run blind-spot checks.** Check untracked/ignored files, dirty indexes,
   stashes, submodules, nested repositories, shallow clones, reused remote
   names, protected branches, git/jj disagreement, unreachable registered
   workspaces, unresolved named blockers or open questions, missing promotion
   records, conflicting completion timestamps, and landing-evidence drift. Downgrade the
   candidate on any unresolved risk.
8. **Request per-target approval.** Present target type and exact path. For VCS
   targets, include the registered workspace; for state targets, include the
   centralized `state_root` and recorded source `Location`. Also present lifecycle
   class, recommendation, retirement-gate evidence,
   `retirement_ready_at`, landing age, promotion anchor, blind spots,
   backup/restore plan, and exact archival or VCS removal command. Only a
   gate-passing completed work stream is selectable as a state target. Never
   infer approval from `/cleanup`.
9. **Back up approved targets.** Use a unique timestamped directory below the
   platform OS temporary root. For a state target, copy that exact
   work directory including dotfiles, write metadata containing `state_root`,
   recorded source `Location`, work ID, repository revision, promotion anchor, evidence summary,
   original path, and restoration command, then verify the backup is nonempty
   and its manifest matches. Preserve existing git bundle/patch backups for
   branches and full-directory backups for worktrees. For jj changes, record
   IDs and restoration commands because operation history preserves them.
10. **Retire only approved, verified targets.** Move a completed stream's fully
    resolved `state_root/.state/works/<work-id>` directory to
    `state_root/.state/archive/<work-id>` first, then drop its overview row. Never delete
    a completed stream or anything under `state_root/.state/archive/`: the permanent
    archive is what prevents retired IDs from being reused. Recheck the gate
    and backup immediately before the move; never target `state_root/.state/works/`,
    `state_root/.state/archive/`, `state_root/.state/`, a workspace root, a glob, or an unresolved
    variable. Use the existing safe git/jj commands for separately approved
    VCS targets.
    Forced worktree/branch removal requires a separate explicit approval.
11. **Verify and report.** Re-run inventories. For each archived state target,
    prove the source `state_root/.state/works/<work-id>` path is absent, the matching
    `state_root/.state/archive/<work-id>` path is present, its content matches the
    verified pre-move manifest plus work ID and repository revision, and its
    overview row is absent. Prove the archived stream has no named blocker/open
    question; when responsibility was transferred, verify the named durable
    carrier remains discoverable and contains the transferred question, and
    verify the completion-receipt evidence. Prove each unapproved target
    remains, the promotion anchor remains intact, and restoration information
    is usable.

<IMPORTANT>
Cleanup is never automatic. A completed lifecycle routes to permanent archive,
not deletion, after its applicable landing evidence has aged three days.
Per-target confirmation and a verified recoverable backup remain required.
Ambiguous evidence always preserves the directory.
</IMPORTANT>

## Verification

- Inventory covers branches/remotes when available, registered Git worktrees,
  registered jj workspaces/changes, and work directories under the one resolved
  `state_root/.state/works/` path.
- Each work directory has lifecycle and retirement classifications, recorded
  source `Location`, promotion anchor, gate evidence, and landing age.
- No active, interrupted, ambiguous, under-window, or incomplete-gate work
  is archivable.
- A completed stream with a named blocker/open question remains indexed as
  `needs review` until the question is answered or transferred to a named
  durable carrier and the blocker is cleared.
- A lifecycle `completed` label cannot override unfinished required tasks or a
  `state.md` reading that contradicts it.
- Every destructive action has explicit approval and verified recovery; the
  post-audit proves every archived source is absent, its content-verified
  archive is present, its overview row is removed, and retained targets remain.
- Validate with strict plugin validation and `quick_validate.py`; record known
  baseline warnings rather than masking them.

## Completion

Report tool/remote freshness and counts by VCS target plus work lifecycle
(`active`, `interrupted`, `completed`, `ambiguous`) and cleanup disposition.
For every state candidate report `state_root`, recorded source `Location`, work ID,
retirement gates, `retirement_ready_at`, landing age, promotion anchor,
backup path, action, and restoration command. Report `generated_files` as `[]`
unless a separately authorized project-artifact write actually occurred.
