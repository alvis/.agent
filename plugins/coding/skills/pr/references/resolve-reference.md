# Resolve a Number to a PR or a Stack

GitHub numbers pull requests and PR stacks in **separate sequences**, so one
number can name a PR and an unrelated stack at the same time, and a valid stack
number is routinely absent from the PR namespace. Every `coding:pr` route that
accepts a number resolves it here first, and none may report a reference as
missing until both namespaces have been tried.

## Bind the preferred namespace

Derive one preference from the request's own words, never from which lookup is
cheaper or which one already failed.

| Request wording | Preference |
| --- | --- |
| `stack`, `PR stack`, `stack <n>`, a stack URL | stack |
| `PR`, `pull request`, a bare `#<n>`, a `/pull/<n>` URL | pr |

The preference orders the two lookups; it never restricts them. With no
namespace word at all, prefer pr and treat a double match as ambiguous below.

## Ask both namespaces

Both lookups are metadata reads. Neither moves a source tree, so resolution
reports on any repository and never depends on landing anything first.

The stack namespace answers from the inventory that owns stack metadata,
[List and land](github-stacks.md#list-and-land). Match the number against each
stack's `number`, and read that stack's members — their PR numbers, states,
draft flags, and head branches — from the same response.

The PR namespace answers from `gh pr view`:

```bash
gh pr view "$NUMBER" --json number,url,title,state,isDraft,baseRefName,headRefName
```

Only `Could not resolve to a PullRequest` or `no pull requests found` means the
number is absent from the PR namespace; any other failure is that failure, so
preserve its stderr and stop. On absence, read the stack inventory instead of
reporting the reference as unlocatable.

A number can also name a stack member rather than a stack: when the inventory
lists it under a stack's members, report the stack it belongs to alongside the
PR itself.

<IMPORTANT>
Never claim a reference cannot be located until both the PR lookup and the stack
inventory have been read, and name the stacks the inventory does hold when
reporting absence.

When both namespaces hold the number, name both matches and state which one the
run acted on. When the request also carried no namespace word, ask before
landing anything: the PR and the stack put the workspace on different heads and
merge different sets of commits.
</IMPORTANT>

## Land the resolved surface

`checkout` is read-mostly navigation: it fetches and adds a workspace, and it
owns no commit, history rewrite, push, or PR publication.

Landing is a `jj` operation on a resolved head branch, never a source-tree
switch in whichever directory the request arrived in. Follow
`coding:references/jj.md` for colocation and its linked-worktree rule, bind
`REMOTE` through
[Bind the push remote](create-update.md#bind-the-push-remote), then fetch the
resolved head and add a workspace on it:

```bash
jj git fetch --remote "$REMOTE" || exit $?
jj workspace add ~/.workspaces/<project-root-folder-name>/<work-id> \
  --revision "$HEAD_REF@$REMOTE" || exit $?
```

Bind `HEAD_REF` from the resolution itself: a stack lands on its top member's
head branch, a PR on its own `headRefName`, and a branch reference on itself.
The new workspace holds that revision and leaves every other workspace's
uncommitted work untouched, which is why landing needs no clean-tree guard.

Report which head the workspace holds. Landing a member instead of the top puts
the work mid-stack with the members above it absent, so offer the top head
whenever the request named a stack — and say so when `gh pr view` shows a base
that is another PR's head, or the inventory lists the number as a member.

Edit only from that workspace; `coding:commit` owns every change made there.
