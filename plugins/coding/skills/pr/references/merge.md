# Merge Stacked Pull Requests

Merge a supplied stack of GitHub PRs bottom-up with `gh`, restacking every remaining downstream branch after each merge so GitHub-generated merge commits or rebased commits do not cause the next PR to replay already-merged work. This skill owns remote PR merges plus descendant branch/bookmark rebases in either git or jj repositories; local commit creation remains `coding:commit`, and code/CI repair remains `coding:fix`.

Load [stacked-prs.md](stacked-prs.md) first for the shared stack contract and
jj/git operator map.

## Boundaries

- Use for: `/coding:pr merge 12 13 14`, "merge this stack of PRs", or any
  request to merge dependent GitHub PRs while automatically rebasing downstream
  PR branches.
- Do not use for: creating PRs (`coding:commit --create-pr` +
  `coding:pr create`), saving local changes (`coding:commit`), writing code
  fixes (`coding:fix`), or validating unpushed commits before opening PRs
  (`coding:finalize-commits`).

## Inputs

- **Required**: PR numbers in bottom-to-top order unless the user explicitly states the order is unknown; verify and stop if the real stack is not exactly linear.
- **Optional**:
  - `--method=rebase|squash|merge`; default is `rebase`.
  - `--force`; bypasses the green-CI gate but never bypasses stack-shape validation or conflict safety.
  - `--remote <name>`; select the named push remote.
  - `--destination <branch>`; override the first PR's base after verification.
- **Prerequisites**: authenticated `gh`, a clean git or jj working copy, and all
  target PR head branches/bookmarks pushable by the current actor.

## Merge directions

Merge a stack bottom-to-top. Before each merge, require configured approvals,
green checks unless `--force` was explicit, no conflicts, addressed comments,
and every standard violation fixed. After a lower PR lands, refresh the next
head onto the destination, verify its reduced diff, and update the remaining
chain before continuing.

<IMPORTANT>
- Do not merge any PR until all supplied PRs are proven to form one linear base chain.
- Without `--force`, do not merge any PR unless every PR currently in the stack has green CI.
- If you make or request fixes for failing CI, summarize the changes to the user and post the same summary as a PR comment, then wait for explicit user approval before merging.
- Never rebase a descendant onto an assumed default branch. Before each merge,
  snapshot the current tip of every PR still in the stack, then restack with
  `git rebase --onto <new-parent> <round-parent-tip> <child>` in git repos or
  the equivalent jj rebase. Keep that round's snapshot unchanged until every
  descendant has been restacked, then refresh the saved tips before the next
  merge.
- On conflicts, stop with the current branch, conflicted files, and exact recovery commands; do not resolve unless the user asks.
</IMPORTANT>

## Workflow

1. **Parse arguments and preflight.** Extract PR numbers, merge method,
   `--force`, optional named remote, and optional destination. Reject unknown
   methods. Before inspection or any `REMOTE` use, load and execute
   [Bind the push remote](create-update.md#bind-the-push-remote), passing the
   explicit named remote when supplied. That gate is the sole owner of remote
   resolution, ambiguity failure, evidence, and option-safe remote handling.
   Then bind `DESTINATION` from the explicit input or the first supplied PR's
   base:

   ```bash
   DESTINATION=${CALLER_DESTINATION:-}
   if [ -z "$DESTINATION" ]; then
     DESTINATION=$(gh pr view "$FIRST_PR" --json baseRefName --jq .baseRefName) || exit $?
   fi
   printf 'DESTINATION=%s\n' "$DESTINATION"
   ```

   Select jj only when it exists and the Git
   HEAD equals jj's working-copy parent commit; any missing command, failed
   command, or unequal ID selects the fully supported Git route. Then discover
   the selected route's existing local state before creating or checking out
   anything:

   ```bash
   if command -v jj >/dev/null 2>&1 && \
     GIT_HEAD=$(git rev-parse HEAD 2>/dev/null) && \
     JJ_HEAD=$(jj log -r @- --no-graph -T 'commit_id' 2>/dev/null) && \
     [ "$GIT_HEAD" = "$JJ_HEAD" ]; then
     VCS=jj
     jj status
     jj log -r "$DESTINATION@$REMOTE..@" --no-graph
     jj bookmark list
     jj workspace list
   else
     VCS=git
     git status --short
     git branch --list
     git worktree list
   fi
   gh auth status
   git fetch --prune -- "$REMOTE"
   if [ "$VCS" = jj ]; then
     jj git fetch --remote "$REMOTE"
   fi
   ```

   Reuse an existing clean worktree/workspace or branch/bookmark whose tip matches the PR head. If a local checkout exists but has uncommitted work or a different tip, stop and ask before reusing, moving, or overwriting it.

2. **Read PR metadata.** For every PR, collect number, state, base ref, head ref, head repository owner, head SHA, mergeability, and status rollup:

   ```bash
   gh pr view <n> --json number,state,baseRefName,headRefName,headRepositoryOwner,headRepository,headRefOid,mergeStateStatus,statusCheckRollup,url,title
   ```

   Stop if any PR is closed, merged, from an unavailable fork, or has a head branch/bookmark that cannot be checked out, rewritten, and pushed.

3. **Verify one linear chain.** The stack is valid only when each downstream PR's `baseRefName` equals the previous PR's `headRefName`, and the first PR's base is the destination branch that will receive the stack. Also verify ancestry locally after fetching all heads. In plain git, use:

   ```bash
   git fetch -- "$REMOTE" <base>:refs/remotes/"$REMOTE"/<base>
   git fetch -- "$REMOTE" <head>:refs/remotes/"$REMOTE"/<head>
   git merge-base --is-ancestor "$REMOTE"/<previous-head> "$REMOTE"/<child-head>
   ```

   For PR 1, verify `git merge-base --is-ancestor "$REMOTE"/<base>
   "$REMOTE"/<head>`. In jj repos, verify explicit ancestor containment instead
   of using `x..y`, which does not require `x` to be an ancestor of `y`:

   ```bash
   jj log -r "<previous-head>@$REMOTE & ::<child-head>@$REMOTE" --no-graph -T 'commit_id'
   jj log -r "<base>@$REMOTE & ::<head>@$REMOTE" --no-graph -T 'commit_id'
   ```

   Require each jj command to produce a non-empty commit ID. If any git link fails or any jj containment query is empty, stop and show the expected chain as `base <- PR1 head <- PR2 head ...` plus the detected mismatch.

4. **Check CI unless forced.** Without `--force`, require every status check on every PR to be successful, skipped, or neutral. Treat pending, queued, expected, action-required, cancelled, timed-out, failure, error, or missing required checks as not green. Use both `mergeStateStatus` and `statusCheckRollup` from `gh pr view`.

   If CI is not green, print a concise summary of failing checks and likely issue areas by PR, then ask whether the user wants to fix the issues locally and update the affected PRs. Suggest running `coding:fix` on the detected CI issues, updating the stacked PRs, then `/loop` for 1 minute to wait for checks to turn green or rerun the fix when they fail again. Stop before merging until the user chooses a fix or force path.

5. **Record branch identities and initial tips.** Save every PR head SHA/change ID and branch or bookmark name in order. The tips establish the first round's cut points and must be refreshed between later rounds:

   ```bash
   saved_tip_<n>=$(git rev-parse "$REMOTE"/<head-branch>)
   saved_tip_<n>=$(jj log -r "<head-branch>@$REMOTE" --no-graph -T 'change_id')
   ```

6. **Merge and restack bottom-up.** For each PR from bottom to top:

   a. Recheck that the current PR is green unless `--force`, because prior restacks rerun CI. Immediately before merging, snapshot the current tip of the PR being merged and every remaining descendant. These immutable round tips are the cut points for every descendant rebase in this round:

   ```bash
   round_tip_<n>=$(git rev-parse "$REMOTE"/<head-branch>)
   round_tip_<n>=$(jj log -r "<head-branch>@$REMOTE" --no-graph -T 'change_id')
   ```

   b. Merge it with the selected method:

   ```bash
   gh pr merge <number> --rebase --delete-branch=false
   gh pr merge <number> --squash --delete-branch=false
   gh pr merge <number> --merge --delete-branch=false
   ```

   Use exactly one command matching `--method`. Keep `--delete-branch=false` until all descendants have been restacked.

   c. Fetch the new parent target:

   ```bash
   git fetch --prune -- "$REMOTE"
   ```

   d. Restack every remaining downstream PR through the repository's native
   VCS path. Plain Git iterates link by link: the immediate child replays only
   child-exclusive commits onto `"$REMOTE"/"$DESTINATION"` using the merged
   parent's `round_tip`; each deeper descendant replays onto its freshly
   restacked parent using that parent's pre-restack `round_tip`:

   ```bash
   git switch <child-head-branch>
   git rebase --onto <new-parent-ref> <round-parent-tip-sha>
   git push --force-with-lease -- "$REMOTE" HEAD:<child-head-branch>
   ```

   ```bash
   child_root=$(jj log -r 'roots(<round-parent-tip>..<round-child-tip>)' --no-graph -T 'change_id')
   jj rebase -s "$child_root" --onto <new-parent-ref>
   REMAINING_BOOKMARKS=(
     <child-head-branch>
     <grandchild-head-branch>
   )
   "$CODING_PR_SKILL_DIR/scripts/preflight-jj-range-push.sh" \
     --remote "$REMOTE" "${REMAINING_BOOKMARKS[@]}" || exit $?
   ```

   jj does not iterate links. Rebase exactly once from the immediate
   child-exclusive root: that source rebase automatically rebases every
   descendant and moves their bookmarks. Bind `REMOTE` to the resolved head
   remote and build `REMAINING_BOOKMARKS` from the recorded remaining PR heads
   in bottom-to-top order. The helper resolves the first and last bookmarks to
   exactly one post-rebase commit each, proves the first is an ancestor of the
   last, and builds their inclusive `FIRST::LAST` range. It pins one jj
   operation for every lookup and the push so concurrent local operations
   cannot invalidate the evidence. Per the current Jujutsu
   [`git push --revision` contract](https://docs.jj-vcs.dev/latest/cli-reference/#jj-git-push),
   that selector includes every local bookmark and tag pointing to a selected
   commit. Therefore the helper requires the range's bookmarks to equal the
   recorded set exactly and requires no tags before publishing all and only
   remaining affected bookmarks once. Every rejection exits before its sole
   push command. Never widen the range or accept an extra ref.
   Jujutsu's push safety checks are lease-like: rerun
   `jj git fetch --remote "$REMOTE"` and resolve bookmark conflicts if a remote
   bookmark changed unexpectedly.

   e. After each plain-Git link push, or after the one jj batch push, set and
   verify every remaining PR's base as its new parent branch. The immediate
   child targets the destination; deeper descendants retain the freshly
   restacked predecessor head:

   ```bash
   gh pr edit <child-number> --base <new-parent-branch>
   gh pr view <child-number> --json baseRefName --jq .baseRefName
   ```

   Then use the child's new local tip as `<new-parent-ref>` for its child, but
   do not change a `round_tip` mid-round. After all descendants are pushed,
   refresh saved tips for the next round.

   f. Wait for GitHub to observe the push, then re-check CI before merging the next PR. If checks are pending, report that the stack was restacked and stop unless the user asked to wait; if asked to wait, poll at a reasonable interval for up to the user's requested duration.

7. **Fix handling gate.** If any CI fix was made during this workflow by invoking or following `coding:fix`, update the affected PR branches/bookmarks using the same restack and push instructions above, but do not perform any `gh pr merge` action for the fixed PR or any downstream PR until the user gives explicit approval. Post a comment on the relevant PRs with the fix summary:

   ```bash
   gh pr comment <number> --body-file <summary-file>
   ```

   Then present the same summary to the user and wait for explicit approval before returning to step 4. Until approval arrives, treat all downstream PRs as blocked even if their checks are green.

8. **Conflict or failure recovery.** On rebase conflict, stop immediately and show the recovery commands for the active VCS:

   ```bash
   git status --short
   git rebase --abort
   git rebase --continue
   ```

   ```bash
   jj status
   jj op log -n 5
   jj op restore <operation-id-before-rebase>
   ```

   Include the conflicted branch/bookmark, round parent tip, intended new
   parent, and PR number. On push rejection, run
   `jj git fetch --remote "$REMOTE"` or `git fetch -- "$REMOTE"`, then rerun
   the same native restack only after confirming the remote branch/bookmark was
   not updated by someone else.

## Verification

- Dry-run mentally from the recorded metadata before mutating: the detected chain must be exactly linear.
- Before every merge without `--force`, `gh pr view <n> --json mergeStateStatus,statusCheckRollup` must show green checks for the PR being merged.
- After every restack, verify ancestry with the active VCS:

  ```bash
  git merge-base --is-ancestor <new-parent-ref> "$REMOTE"/<child-head-branch>
  jj log -r "<new-parent-ref> & ::<child-head-branch>@$REMOTE" --no-graph -T 'commit_id'
  ```

  Require the jj containment query to produce a non-empty commit ID.

- Validate this skill when edited:

  ```bash
  bash "$CODING_PR_SKILL_DIR/scripts/test-jj-range-push.sh"
  claude plugin validate --strict plugins/coding
  uv run --python 3.13 plugins/governance/skills/write-skill/scripts/quick_validate.py plugins/coding/skills/pr
  ```

## Completion

Report the PRs merged, merge method, branches/bookmarks restacked, per-round parent tips used as cut points, CI status after each restack, comments posted for any fixes, and any blocked PRs. Once the stack has merged, inspect `git worktree list` and `jj workspace list` for worktrees/workspaces whose current tips exactly match the merged PR head tips, then ask the user whether they also want those corresponding git worktrees or jj workspaces removed; do not remove them without confirmation. If stopped for approval after fixes, clearly say that no merge occurred after those fixes and identify the approval needed.
