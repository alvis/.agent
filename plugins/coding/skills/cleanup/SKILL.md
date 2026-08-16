---
name: cleanup
description: Audit and safely retire stale development state across git branches, registered Git worktrees, jj workspaces, and workspace-local state directories. Use for /cleanup or abandoned-work audits; require evidence, retention, recoverable backup, and per-target approval before removal.
metadata:
  intelligence: high
argument-hint: "[path] [--exclude-remote]"
---

# Cleanup

Before any `jj` decision or command, follow
`coding:references/jj.md`.

Own evidence-first cleanup of no-longer-needed development state: branches,
registered worktrees/workspaces, jj changes, and ignored
`.state/works/<work-id>/` directories. Inventory first, preserve ambiguity,
and remove only individually approved, recoverably backed-up eligible targets.

## Boundaries

- Audit stale or divergent git/jj state and workspace-local state.
- Do not perform source dead-code removal, linting, PR authoring, or history
  rewriting. History mutations remain owned by `coding:commit`.
- Never discover workspaces by scanning sibling or `~/.workspaces/` directories.
  State scope is limited to the current workspace and paths explicitly
  registered by local Git or jj metadata.
- Age alone, a merged branch, or a directory named “complete” never authorizes
  state deletion. Active, interrupted, or ambiguous work is
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
3. **Inventory workspace-local state.** Deduplicate registered
   workspace paths by canonical filesystem identity. Within each reachable
   path, enumerate only `.state/works/*` and record:
   - VCS kind, registered workspace name/path, and local-only scope;
   - work ID/path, `state/working.md` and `state.md` presence, lifecycle status,
     owner, goal, repository revision, completion timestamp, and blockers;
   - `review.md` plus the seven review-area dispositions;
   - durable architecture/design/spec promotion paths and receipts;
   - Notion source identity and completion receipt: outbound push, conflict
     dispositions, verification pull, and zero unexpected diff;
   - promoted `docs/` paths and the work directory's own final state;
   - repository retention policy and timestamps for every closure gate.

   Read `state/working.md` first for navigation, then verify all retirement evidence
   from `state.md` and its exact links. Read `state.md` (and any `state/*.md`
   children) directly for every candidate and record lifecycle status,
   canonical `plan_source: state.md`, status counts, runnable/blocked task
   IDs, and any inconsistency. State that is malformed, contradictory, or
   otherwise unreadable makes the candidate ambiguous and ineligible; cleanup
   never migrates it. Filesystem modification time is only a
   clue; it never substitutes for lifecycle or promotion timestamps. The same
   work ID in another workspace is a separate local copy and separate target.
4. **Classify lifecycle independently of cleanup eligibility.**
   - **Active**: state says active/in progress, has a live current focus, open
     implementation, or current branch/PR activity.
   - **Interrupted**: unfinished work is paused or blocked and has a recorded
     next action.
   - **Completed**: the lifecycle state in `state.md` reads `completed`, every
     required executable leaf is `done`, no required leaf is planned/working/failed/
     blocked, and acceptance plus repository revision are coherent. A prose
     label or lifecycle field the task table does not bear out is not completion.
   - **Ambiguous**: state is missing/malformed/contradictory, owner or revision
     is unclear, copied state is suspected, or authoritative evidence cannot
     establish one of the prior classes. Preserve it.
5. **Apply the state retirement gate.** A completed local work
   directory is `recommend cleanup` only when every condition is evidenced:
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
   - the durable knowledge is promoted to the repository's `docs/` and the work
     directory's own final state matches it on work ID and repository revision;
   - elapsed retention is at least the repository policy, never less than 30
     days. Measure from `retirement_ready_at`: the latest timestamp among work
     completion, review closure, durable promotion, Notion verification, and
     the work directory's final state write.

   A missing/inaccessible gate yields `needs review`; active, interrupted, and
   ambiguous work yields `do not cleanup`. Never recommend deletion merely
   because the directory is old or its branch merged.
6. **Classify traditional VCS candidates.** Recommend cleanup only for merged
   or content-equivalent state whose retained copy is proven. Mark closed but
   unmerged PRs, dirty worktrees, divergent jj state, stale remote evidence,
   and uncertain ownership `needs review`. Protect default/release branches,
   open PRs, unpushed commits, and unbacked changes.
7. **Run blind-spot checks.** Check untracked/ignored files, dirty indexes,
   stashes, submodules, nested repositories, shallow clones, reused remote
   names, protected branches, git/jj disagreement, unreachable registered
   workspaces, duplicated work IDs, missing promotion records, conflicting
   completion timestamps, and repository retention overrides. Downgrade the
   candidate on any unresolved risk.
8. **Request per-target approval.** Present target type, exact local workspace
   and path, lifecycle class, recommendation, retirement-gate evidence,
   `retirement_ready_at`, age/policy, promotion anchor, blind spots,
   backup/restore plan, and exact removal command. Only gate-passing completed
   work stream is selectable. Never infer approval from `/cleanup`.
9. **Back up approved targets.** Use a unique timestamped directory below the
   platform OS temporary root. For a state target, copy that exact
   work directory including dotfiles, write metadata containing workspace
   identity, work ID, repository revision, promotion anchor, evidence summary,
   original path, and restoration command, then verify the backup is nonempty
   and its manifest matches. Preserve existing git bundle/patch backups for
   branches and full-directory backups for worktrees. For jj changes, record
   IDs and restoration commands because operation history preserves them.
10. **Remove only approved, verified targets.** This skill deletes under
    `.state/works/` alone and never touches `.state/archive/`, which is
    permanent and is the only thing holding a retired ID against reuse — so a
    stream that was archived keeps its name whatever happens here, and one
    deleted straight out of `works/` does not. Confirm before deleting that
    everything worth keeping was promoted to `docs/` under step 8's promotion
    anchor — nothing that survives the stream may exist only in the directory
    being deleted. Use the existing safe git/jj
    commands. Remove a state directory only by its fully resolved,
    validated `.state/works/<work-id>` path after rechecking the gate and
    backup immediately before deletion; never target `.state/works/`,
    `.state/`, a workspace root, a glob, or an unresolved variable.
    Forced worktree/branch removal requires a separate explicit approval.
11. **Verify and report.** Re-run inventories. Prove each approved target is
    absent, each unapproved target remains, the promotion anchor remains
    intact, and restoration information is usable.

<IMPORTANT>
Cleanup is never automatic. State deletion additionally requires a
completed lifecycle, every retirement gate, at least 30 days of retention,
per-target confirmation, and a verified recoverable backup. Ambiguous evidence
always preserves the directory.
</IMPORTANT>

## Verification

- Inventory covers branches/remotes when available, registered Git worktrees,
  registered jj workspaces/changes, and work directories within every resolved
  local workspace path.
- Each work directory has lifecycle and cleanup classifications, local
  workspace scope, promotion anchor, gate evidence, and retention age.
- No active, interrupted, ambiguous, under-retention, or incomplete-gate work
  is removable.
- A lifecycle `completed` label cannot override unfinished required tasks or a
  `state.md` reading that contradicts it.
- Every destructive action has explicit approval and verified recovery; the
  post-audit proves retained targets remain.
- Validate with strict plugin validation and `quick_validate.py`; record known
  baseline warnings rather than masking them.

## Completion

Report tool/remote freshness and counts by VCS target plus work lifecycle
(`active`, `interrupted`, `completed`, `ambiguous`) and cleanup disposition.
For every state candidate report workspace path/name, work ID,
retirement gates, `retirement_ready_at`, effective retention, promotion anchor,
backup path, action, and restoration command. Report `generated_files` as `[]`
unless a separately authorized project-artifact write actually occurred.
