# GitHub PR Stacks

Use the current upstream skill at
<https://github.com/github/gh-stack/blob/main/skills/gh-stack/SKILL.md>, the
[official documentation](https://gh.io/stacks), and
`gh stack <command> --help` for the latest contract. Load this reference for
every GitHub PR-stack request, regardless of which `coding:pr` route received
it.

For the jj route, consult the current
[bookmark documentation](https://docs.jj-vcs.dev/latest/bookmarks/),
[Git comparison for experts](https://docs.jj-vcs.dev/latest/git-experts/), and
live `jj git push --help` output before relying on push behavior.

Choose history ownership once. A repository is jj-colocated only when
`git rev-parse HEAD` equals
`jj log -r @- --no-graph -T 'commit_id'`; a missing command, failed command, or
different ID selects the fully supported plain Git route. `coding:pr review`
owns review on both routes.

## Contents

- [Run the requested action](#run-the-requested-action)
- [List and land](#list-and-land)
- [Create, extend, and publish](#create-extend-and-publish)
- [Update and synchronize](#update-and-synchronize)
- [Restructure or remove grouping](#restructure-or-remove-grouping)
- [Merge and navigate](#merge-and-navigate)
- [Verify and recover](#verify-and-recover)

## Run the requested action

Attempt the requested command or API call directly. Do not run `gh auth status`
or a general extension probe first. Authentication, repository support, and
extension availability are operational failures, not preconditions. Inventory
uses the REST endpoint below and does not inspect, install, or invoke the
extension.

If an attempted `gh stack` action reports that the extension is missing or
offers installation, ask before running:

```bash
gh extension install github/gh-stack
```

Never install implicitly. For every other failure, preserve stderr, stop, and
report the command and unchanged or partial state. Do not convert an auth or API
failure into a speculative setup step.

Agents must select non-interactive forms:

| Action | Agent form | Avoid |
| --- | --- | --- |
| inspect | `gh stack view --json` | bare `view` |
| submit | `gh stack submit --auto [--remote <name>]` | bare `submit` |
| initialize | `gh stack init [--base <trunk>] <branch>...` | bare `init` |
| add layer | `gh stack add <branch>` | bare `add` |
| merge | `gh stack merge <target> --yes --merge-method <method>` | interactive merge |

`modify` is an interactive TUI and has no non-interactive restructure form.
An agent may use only `modify --continue` or `modify --abort` for an existing
session; otherwise ask the user to operate the TUI or use the explicit
unstack-and-reinitialize path below.

Set `--remote <name>` on `link`, `push`, `submit`, `sync`, and `rebase` when the
repository has multiple remotes.

The plain-Git navigation, `init`, and `rebase` operators act on the layer the
source tree currently holds, so they move it. As plugin safety policy, prove the
tree is clean immediately before each of them; this is not an upstream CLI
precondition:

```bash
WORKTREE_STATUS=$(git status --porcelain) || exit $?
test -z "$WORKTREE_STATUS" || {
  echo 'refusing to move the source tree: uncommitted changes' >&2
  exit 1
}
```

The jj route needs no such guard: it lands a resolved head in a new workspace
and leaves every existing one untouched.

## List and land

For `/coding:pr stack list`, unconditionally inventory the current repository
through its paginated `GET /repos/{owner}/{repo}/stacks` REST endpoint. Fetch
every page and retain the JSON for agent decisions. The REST inventory keeps
fully merged and closed stacks returned by the API.

```bash
bash "${CODING_PR_SKILL_DIR}/scripts/list-github-stacks.sh"
```

An empty array is success. A nonzero API status is failure; preserve stderr and
stop.

That inventory is the only stack metadata this skill needs, and it needs no
terminal. Every stack reports its number, destination, and open flag; every
member reports its PR number, state, draft flag, head branch, and head SHA —
enough to name a stack, pick a member, and see what is still open without a
second call. Select the open stacks for a landing decision; an empty selection
means the repository holds no open stack, which is an answer, not a lookup
failure.

Landing is explicit and deterministic: require the caller's stack number, PR
number, PR URL, or branch, and bind a bare number's namespace first through
[resolve-reference.md](resolve-reference.md), because a stack number and a PR
number carrying the same digits select different heads. Landing itself is a jj
operation on the resolved head branch — fetch, then add a workspace, as
[Land the resolved surface](resolve-reference.md#land-the-resolved-surface)
directs. No gh-stack operator lands a stack for an agent, so no local stack
tracking exists to inspect: verify the landed head against this REST inventory
and `gh pr view` rather than `gh stack view --json`.

Adopting a GitHub-only stack into local gh-stack tracking has no
non-interactive form and is not an agent operation. When a plain-Git repository
needs that tracking, ask the user to establish it.

## Create, extend, and publish

### jj-colocated repositories

All editing, saving, splitting, reordering, and rewriting goes through
`coding:commit`. Rely on jj's automatic descendant rebase and bookmark movement
after an owning change is rewritten. Do not subsequently run the gh-stack
history publication operators over jj-owned history.

Publish all and only affected unmerged bookmarks in one command. Build the
argument list from the explicit bottom-to-top stack map; never infer it from a
prefix or select every bookmark implicitly:

```bash
jj git push --remote "$REMOTE" \
  --bookmark "$BOTTOM_BOOKMARK" \
  --bookmark "$NEXT_BOOKMARK" \
  --bookmark "$TOP_BOOKMARK" || exit $?
```

jj checks each selected bookmark against its last-seen remote state before
updating it, providing force-with-lease-like protection against overwriting a
remote advance; preserve stderr and report partial state on failure. After the
call, verify every remote head, every PR base, every PR's draft state, and
GitHub grouping before continuing.

`gh stack link` is a conditional, additive, no local tracking bridge for PR
creation, grouping, base repair, or membership. It is not routine history
publication. Its branch arguments are pushed non-force and atomically; that is
link behavior, not an atomicity claim about the preceding `jj git push`. Use it
only after the explicit jj push when GitHub stack state is missing or wrong:

A new stack requires at least two branch or PR selectors. To extend an existing
stack, pass its stack number first and then at least one branch or PR selector.

```bash
gh stack link --base "$DESTINATION" --remote "$REMOTE" \
  "$BOTTOM_BOOKMARK" "$NEXT_BOOKMARK" "$TOP_BOOKMARK" || exit $?
```

The command may create missing PRs, repair bases, and add members; its additive
membership behavior never removes members. Omit `--open` to preserve draft
creation. Because it creates
no local tracking, verify grouping through the paginated Stacks REST projection
and verify every PR with `gh pr view`.

### Plain Git repositories

Initialize explicit bottom-to-top branches and add later layers with current
extension commands:

```bash
git config rerere.enabled true || exit $?
gh stack init --base "$DESTINATION" "$BOTTOM" "$NEXT" "$TOP" || exit $?
gh stack add "$NEW_TOP" || exit $?
```

Existing branches are adopted by `init`; missing ones are created, and the last
branch is checked out. Enabling rerere prevents `init` from opening its first-run
confirmation prompt. `add` must run from the current top. Use `coding:commit`
for each layer's plain commit rather than `add -m`/`-A`/`-u`.

For a locally tracked stack, publish with:

```bash
gh stack submit --auto --remote "$REMOTE" || exit $?
gh stack view --json || exit $?
```

`submit --auto` skips the editor and creates new PRs as drafts. Add `--open`
only when ready-for-review state was requested. Submission pushes branches,
creates or updates PRs and their bases, and creates or updates GitHub grouping.
It is non-atomic: a later branch push or PR update can fail after earlier
branches or PRs changed. Preserve the pre-operation remote head and PR map,
then verify every branch, PR base, draft state, and grouping so partial effects
are reported exactly.

## Update and synchronize

### jj-colocated repositories

Put every history update through `coding:commit`. Rely on jj's automatic
descendant rebase and bookmark movement, then republish once through the
explicit affected-unmerged-bookmark batch defined above. Never follow that
publication with gh-stack's rebase, sync, push, or submit operators.

### Plain Git repositories

Run the clean-tree guard from
[Run the requested action](#run-the-requested-action), position the source tree
on the earliest unmerged owning layer with the extension's own navigation, put
the plain commit there through `coding:commit`, then propagate it:

```bash
gh stack bottom || exit $?
gh stack up "$LAYERS_ABOVE_BOTTOM" || exit $?
# Invoke /coding:commit for the owning layer before continuing.
gh stack rebase --upstack --remote "$REMOTE" || exit $?
gh stack push --remote "$REMOTE" || exit $?
gh stack view --json || exit $?
```

Bind `LAYERS_ABOVE_BOTTOM` from the recorded bottom-to-top layer map, and omit
the `up` call when the owning layer is the bottom itself. Use
`rebase --downstack` for trunk through the current layer, `--no-trunk` for
inter-layer alignment only, and `--continue` or `--abort` after conflicts.

For full remote reconciliation use:

```bash
gh stack sync --remote "$REMOTE" || exit $?
gh stack view --json || exit $?
```

`sync` fetches, reconciles remote membership, updates trunk, cascade-rebases,
pushes all active branches atomically, refreshes PR state, and links two or more
open PRs. It never creates PRs. Add `--prune` only with explicit approval to
delete local merged branches. It may exit zero after a divergence abort or a
push warning; verify the branch graph, remote head, PR state, and grouping
rather than accepting exit zero as success.

## Restructure or remove grouping

### jj-colocated regrouping

Record the paginated Stacks REST projection, then remove only the remote
grouping with an explicit target:

```bash
gh stack unstack "$STACK_NUMBER" || exit $?
```

Stop and verify the intended remote unstack through the paginated Stacks REST
projection and `gh pr view`. Only after that verification succeeds, use the
conditional additive `gh stack link` bridge from the jj route to recreate or
repair grouping, bases, and membership. Do not initialize local gh-stack
tracking or submit jj-owned history.

### Plain Git regrouping

For a human-operated restructure, `gh stack modify` can drop, fold, insert,
reorder, and rename layers; afterward the agent runs
`gh stack submit --auto [--remote <name>]` to publish the new shape. Agents do
not drive this TUI.

For a deterministic regroup, record `gh stack view --json`, then remove only
the grouping with an explicit target:

```bash
gh stack unstack "$STACK_NUMBER" || exit $?
```

Stop and verify the intended remote unstack through the paginated Stacks REST
projection and `gh pr view`. Only after that verification succeeds, rebuild and
publish the local stack:

```bash
gh stack init --base "$DESTINATION" "$BOTTOM" "$NEXT" "$TOP" || exit $?
gh stack submit --auto --remote "$REMOTE" || exit $?
gh stack view --json || exit $?
```

`gh stack unstack <stack-number>` deletes neither PRs nor branches. A partial
remote unstack leaves merged, merging, or queued PRs—including PRs with
auto-merge enabled—in the remote stack and leaves local tracking unchanged.
`--local` removes only local tracking and preserves GitHub grouping. Verify both
scopes after the call: use the paginated Stacks REST projection and `gh pr view`
for every member, and use `view --json` for local tracking. After
`unstack --local`, verify that the former branch reports no local stack while
the REST projection still contains the remote grouping. Never delete or close a
PR merely to change stack membership.

## Merge and navigate

Use GitHub's atomic stack merge, not `gh pr merge` or the generic bottom-up
loop, for a GitHub PR stack:

```bash
gh stack merge "$STACK_OR_PR_NUMBER" --yes \
  --merge-method "$MERGE_METHOD" || exit $?
```

Bind `MERGE_METHOD` from the caller or repository policy; do not select a
default. The equivalent explicit flags are `--squash`, `--rebase`, or
`--merge`. A PR target merges that PR and every unmerged PR below it; a stack
target merges the whole stack. The operation is all-or-nothing unless a merge
queue accepts the stack, in which case repository queue policy controls
landing.

`gh stack up [n]`, `down [n]`, `top`, `bottom`, and `trunk` are supported
non-interactive navigation commands for a locally tracked plain-Git stack. They
move the source tree, so run the clean-tree guard from
[Run the requested action](#run-the-requested-action) first and confirm the
destination with `view --json` afterward. Do not use interactive
`gh stack switch`.

On the jj route, moving between members is a revision choice, not a tree
switch: add or reuse a workspace at the member's `<head-branch>@<remote>` as
[Land the resolved surface](resolve-reference.md#land-the-resolved-surface)
directs, so one member's work never displaces another's.

## Verify and recover

After every locally tracked mutation, use `gh stack view --json` to confirm
saved local order, current branch, PR URLs, heads, bases, merge state, and
`needsRebase`. Its API refresh is best-effort, so separately use `gh pr view`
to verify remote head SHAs, bases, and draft state. For `link`, remote unstack,
and regrouping, verify grouping through the paginated Stacks REST projection;
`view --json` cannot verify state that has no local tracking.

- Do not trust exit status alone: divergence and push-warning paths can leave
  `sync` at exit zero. Verify post-state.
- `push` and `submit` are non-atomic: they may update earlier branches before a
  later lease fails. Preserve the pre-operation remote head map, report partial
  progress, and retry only after resolving the rejected branch.
- Resolve a rebase conflict, stage files, and run `rebase --continue`, or run
  `rebase --abort`; never leave a partial rebase as success.
- Repository support, authentication, API, ambiguity, lock, and invalid-input
  errors are command failures. Preserve their stderr and stop.
