# Per-Commit Atomic Finalize — procedure (jj + git)

Referenced from SKILL.md Step 3. Run by one mechanical-intelligence agent per commit. Finalizes EXACTLY ONE commit through seven sub-steps — replay, isolate, marker-check, gate, fold, reword, mark — that execute inside ONE dispatch. The operation is atomic: no sub-step may be deferred to a later phase or batched across commits, a commit is never left QA'd-but-unfolded, and the walk never advances past an unfolded commit. Patch-id marker mechanics: `markers.md`. Conventional Commits contract: `../../commit/references/conventional-commits.md`; commit and branch directions: `../../commit/SKILL.md`.

Ownership: this reference observes, gates, and **validates** corrections inside disposable worktrees. Every history mutation that lands on an owning commit — fold, amend, reword, snapshot bracket, checkpoint, head move — is **applied by `coding:commit`** on request, with the exact operation and target named. The commands shown below for those steps are the operations to request, not commands this skill's workers run against the user's stack.

Every edit must dissolve cleanly: a lint/test fix folds into the commit so it reads as originally authored, and a reworded subject describes the commit's real contents — never narrate the QA pass.

## Isolation model

- **jj**: `jj edit <rev>` — the working copy becomes that commit; validated edits are staged there. The original `@` change-id was captured at start (SKILL.md Step 1) and is restored at end. Every rule below still binds on this path: one atomic dispatch per commit, the gate run whole, the lock fold mandatory, wrappers bypassed, exit codes captured directly. Generated artifacts (install output, build output) must be ignored so jj's automatic snapshot never sweeps them into the commit — a fold takes tracked edits only.
- **git**: replay each commit onto a rebuild lineage and QA it in a fresh throwaway worktree (Steps 1–2). A `git rebase` walk with `edit`/`break` stops is BANNED: every commit then shares one working tree, untracked generated files (install artifacts, build output) accumulate between commits and pollute later gates, and the only counter-move — `git clean` — is destructive and frequently sandbox-blocked. A worktree created fresh per commit contains tracked files only: isolation by construction, nothing to clean.

### git path — working-copy capture (step 0)

Run once, before target enumeration begins for the git path, so the rebuild walk starts from a clean tree and any pre-existing changes survive the run:

0. Record the pre-run HEAD as `originalHead` (`git rev-parse HEAD`). If the working tree is dirty (`git status --porcelain` non-empty), request a snapshot bracket from `coding:commit`: stage everything and commit it as `finalize-commits: WIP @ (auto)`. Staging with `-A` is correct here and ONLY here — the snapshot must capture the user's untracked files to give them back later, and it never enters finalized history. This WIP commit is a snapshot bracket only — it must NEVER itself be enumerated or finalized as a QA target, which target enumeration enforces structurally by bounding at `originalHead` (`@{upstream}..originalHead`), not `HEAD`. Never use `git stash push`/`git stash pop`; the user's existing stash entries must remain untouched. (`git stash create` may serve as a snapshot fallback if exact staged/unstaged fidelity is ever required; the WIP-commit round-trip restores modified + untracked files but not an exact staged/unstaged split.) Undoing this bracket (see "working-copy restore (final)") is an UNCONDITIONAL exit obligation, owed on every exit path.

## Step 1 — Replay (cherry-pick onto the rebuild lineage)

Given `cur` (the rebuilt parent: the previous iteration's folded sha, or the stack base for position 1) and `target` (the original commit), create this commit's worktree and replay into it. The worktree is detached scratch space — no user ref is touched:

```bash
dir=$(mktemp -d)
git worktree add --detach "$dir" "$cur"
cd "$dir"
git cherry-pick -n "$target"; ec=$?
git commit --no-verify -C "$target"     # signed per repo config; reuses message + authorship; hooks bypassed
```

Conflict handling — exactly one kind auto-resolves:

1. **Lockfile-only conflict** (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`): take the incoming side (`git checkout --theirs <lockfile>`), then run the project install so the lockfile is regenerated against the tree's actual manifests, stage it, and complete the commit. No user prompt. Note that a regeneration happened — it obligates an install + lock fold even on a marker skip (Step 3).
2. **Any other conflict**: do NOT attempt a best-effort merge. Destroy the worktree and raise `pending_decision { kind: semantic_conflict }` so the coordinator decides before anything is committed.

- **jj**: no replay is needed — `jj edit <rev>` positions the working copy directly, and conflicts surface as jj conflict markers. The same rule applies: a lockfile conflict regenerates-and-resolves silently; anything else raises `pending_decision { kind: semantic_conflict }`.

## Step 2 — Isolate (the worktree is the boundary)

The worktree created in Step 1 now sits at the replayed result and holds tracked files only — that is the entire isolation mechanism. All QA for this commit runs inside it; nothing from any other commit's gate can be present, and nothing this gate generates can leak forward, because the worktree is destroyed in Step 7. Never run the gate on a tree another commit has touched, and never reach for `git clean` to scrub one. (jj: the working copy on `<rev>` plays this role; keep generated artifacts ignored so the boundary holds.)

## Step 3 — Marker skip

Compute the commit's lock-excluded patch id (`markers.md`). If a green marker with a matching patch id exists, report `skipped_by_marker: true`, `status: green`, and skip the lint and test legs. One obligation survives the skip: if Step 1 regenerated the lockfile (an upstream fold cascaded into this commit), run the project install and fold the lock (Step 5) before advancing — the marker certifies the commit's content, not a stale lock. Then jump to Step 7.

## Step 4 — QA gate (install + lint + test/coverage, together)

One indivisible gate, run whole inside the worktree. A commit that skips any leg is NOT green, and the gate is never split across phases or batched across commits. Always prefer project scripts over raw tools (per coding hooks/ALLAGENT.md); run in order, stop at first hard failure:

1. **install** — project install (e.g. `npm ci` / `pnpm install`). Failure → `pending_decision { kind: test_fail, detail: install }` (rare; usually environmental).
2. **lint `--fix`** — run the project lint with autofix. Lint and lockfile fixes are validated in the worktree without a user prompt.
3. **test / coverage** — run the project test script; the coverage gate is the test script's exit 0. A failure is NOT auto-fixed: raise `pending_decision { kind: test_fail | coverage_fail }`.

Code fixes are made through `coding:fix` (never hand-edited here) so they meet project standards.

Two execution rules, both born from real false-green incidents:

- **Bypass output-rewriting wrappers.** Shell hooks that rewrite or summarize command output corrupt machine-readable results and have produced false-green gates. Invoke gate commands via `rtk proxy <cmd>` or the direct binaries (`node_modules/.bin/...`), never through the rewriting layer.
- **Capture exit codes directly, never through pipes.** `cmd; ec=$?` — immediately after the command, nothing in between. A pipeline's `$?` is the LAST command's status, and a real false pass came from misreading `$PIPESTATUS` under zsh (zsh spells it `$pipestatus` and indexes from 1). When output must be kept, redirect to a file instead of piping.

## Step 5 — Fold, immediately

Everything the gate changed amends into THIS commit before anything else happens — the fold is part of the same atomic operation, never a later cleanup pass. Validate the corrected tree in the worktree (the gate legs re-pass), then request the fold from `coding:commit`, naming the owning commit. The operation it applies:

- **git** (against the replayed commit):

  ```bash
  git add -u                                  # NEVER -A: bootstrap-generated untracked files must not enter history
  git commit --amend --no-edit --no-verify    # signed per repo config
  ```

- **jj**: edits are already in the working copy on `<rev>`; `jj squash` any stray working-copy delta into it so nothing leaks to `@`. Tracked edits only — generated untracked artifacts stay ignored.

The lockfile this commit's OWN install regenerated is a MANDATORY part of the fold, not best-effort: a commit whose lockfile does not match its own manifests is not green, whatever its tests say. The fold must be seamless — the commit reads as if authored correctly the first time.

## Step 6 — Message conformance

1. Read the current subject. Validate against the contract in `../../commit/references/conventional-commits.md`, following the directions in `../../commit/SKILL.md`. Sample repo style: `git log --format=%s -n 50`.
2. **Mechanical fixes — no user prompt needed**: type prefix casing, trailing-period removal, length trim (≤50 target / ≤72 hard), imperative-mood correction, scope kebab-casing, dropping catalog prefixes. Request the reword from `coding:commit`; the operations it applies:
   - **jj**: `jj describe -r <rev> -m "<subject>"`
   - **git**: `git commit --amend --no-verify -m "<subject>"` (against the replayed commit, before the checkpoint)
3. **Meaning change — confirm first**: a type change (e.g. `feat`→`fix`) or a scope change that alters what the commit claims to do raises `pending_decision { kind: meaning_reword }`. The coordinator confirms through the graphical or structured user-input capability before the reword is requested.

## Step 7 — Mark, checkpoint, advance

Once install + lint + test/coverage pass, the fold is in, and the message conforms with no outstanding decision:

1. Write the lock-excluded patch-id marker (`markers.md`); report `status: green`, `marked: true`.
2. Checkpoint the result via `coding:commit`: `git update-ref refs/finalize/<run>/pos-<N> <foldedSha>` — an abort at any later position resumes from the last such ref. (jj: the op log is the checkpoint; record the change-id in the report.)
3. Destroy the worktree: leave the directory, then `git worktree remove --force "$dir"`.
4. Report the folded sha as `newSha` so the walk chains `cur = newSha` into the next iteration (`workflow.md`).

The branch head and the user's original ref move only after the end-state verify (Gate B in `workflow.md`), applied by `coding:commit`; a mid-walk abort leaves the original ref untouched and the checkpoint refs resumable.

## git path — working-copy restore (final)

Undoing the step-0 snapshot bracket is an UNCONDITIONAL exit obligation: it runs on EVERY exit path — green completion, `pending_decision` halt, abort, error. A WIP commit stranded at the tip is an integrity failure, never an acceptable end state.

- If a WIP commit was created in step 0, request its removal from `coding:commit`: soft-reset it away and return its contents to the working tree unstaged (`git reset --soft HEAD^` then `git restore --staged .`). The tree is back to its pre-run dirty state (modified + untracked files restored, though not an exact staged/unstaged split). If `git stash create` was used as the fallback snapshot, apply that snapshot instead. Never touch the user's existing `git stash` entries.

The jj path needs no equivalent teardown here — its original `@` change-id is restored at the end of the walk.

## Reporting

Return the per-commit report — `revision`, `status`, `skipped_by_marker`, the per-leg `qa` results, `lock_folded`, `gate_bypassed_wrappers`, `message_action`, `marked` — plus `newSha` for the chain. Preserve these keys even when their value is false, empty, or `none`. If any `pending_decision` was raised, set `status: pending_decision` and populate the `pending_decision` block; the coordinator resolves and resumes (see `workflow.md`).
