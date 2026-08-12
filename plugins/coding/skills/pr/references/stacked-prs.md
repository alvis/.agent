# Manage Stacked Pull Requests

Load this reference when a create or update target contains multiple dependent
changes, when merge receives more than one PR, or when the caller has not chosen
a PR shape and the review surface may benefit from a stack.

Apply `GIT-PR-SIZE-*`, `GIT-PR-TYPE-02..05`, and `GIT-PR-STACK-04` from
`coding:standards/git/`; this reference owns stack directions and executable
operators.

## Suggest a stack

Calculate the active size zone with the canonical classifier:

```bash
uv run --python 3.13 \
  "${CODING_PR_SKILL_DIR}/scripts/classify-pr-size.py" \
  --repo "$REPO_ROOT" --base "$BASE_OID" --head "$HEAD_OID"
```

Its file count includes every changed path, including generated, vendored, and
binary files. Its authored net LOC excludes additions and deletions from
recognized package lockfiles and paths marked `linguist-generated` at the base
or head. Use the returned zone; do not inspect or reproduce the classifier's
internal threshold data. A green result is the review surface one reader can
hold at once.

Require a split regardless of size or a standalone preference when one PR
violates the composition standard, including migration with logic or
mechanical refactoring with behaviour. Otherwise
respect an explicit standalone-or-stack choice.

When no shape was chosen, proactively suggest a stack when the proposed PR
exceeds the active green zone and its files form at least two domain-coherent
slices that compile, test, and deliver reviewable value in bottom-to-top order
without forward references.

Do not suggest a split based on counts alone. Generated output, an atomic
migration, or a mechanical refactor may be larger while remaining easier to
review as one change. Every proposed slice must be independently valid:
backward-compatible configuration, schema, contract, migration, or feature-flag
prerequisites may land before their consumers, but dangling updates may not.
Keep tests and lockfiles with the change that needs them. When splitting would
break integrity or merely scatter one mechanical operation, keep one PR and
apply its actual size zone.

Present the suggestion before publication:

```text
Suggested stack:
01 <conventional title> — <files or domain>; base: <destination>
02 <conventional title> — <files or domain>; base: <01 head>
...
```

Ask whether to use an optional proposed stack. A declined optional suggestion
proceeds as one PR with its zone-required sections. A mandatory category split
blocks publication until accepted and shaped through `coding:commit`; neither
path silently reshapes history.

## Stack directions

- Shape local history through `coding:commit`; `coding:pr` does not split,
  reorder, amend, or absorb changes.
- Name each non-work-stream head `<feature-slug>/NN-<scope>` with a shared
  kebab-case slug, a zero-padded bottom-to-top ordinal, and a short kebab-case
  slice name. A work stream uses the branch prefix from
  `essential:references/naming.md` and appends only `NN-<scope>`.
- Require one linear chain from the destination through every selected head.
- Open every PR as draft. PR 01 targets the destination; each later PR targets
  the previous head.
- Fix a finding in the earliest unmerged change that owns it. Once a lower PR
  merges, fix forward instead of rewriting public history.
- Update and merge the complete affected chain bottom-up.

Load [github-stacks.md](github-stacks.md) for every GitHub PR-stack request,
including discovery, checkout, creation, publication, update, navigation,
restructure, unstack, or merge. That reference is the sole owner of GitHub
stack inventory behavior and selects one conditional history owner. A
repository is jj-colocated only when `git rev-parse HEAD` equals
`jj log -r @- --no-graph -T 'commit_id'`; every other result is fully supported
plain Git. On the jj route, `coding:commit` owns history mutation for edit- and
fix-induced rewrites, where jj automatically rebases descendants and moves
bookmarks. Merge-induced descendant topology changes remain owned by
`coding:pr merge`. On the plain Git route, the extension retains its local
tracking and native stack operators.

## Inspect with jj

Before either inspection route, execute the shared authoritative
[REMOTE gate](create-update.md#bind-the-push-remote). Use jj only when it is
functionally colocated with Git. Inspect the candidate chain and bookmark
placement without mutating it:

```bash
jj log -r "<destination>@$REMOTE..<selected-top-change>" --no-graph \
  -T 'change_id.short() ++ " " ++ bookmarks ++ " " ++ description.first_line() ++ "\n"'
jj bookmark list --all
jj log -r '<parent-change> & ::<child-change>' --no-graph -T 'commit_id'
```

For new publication, the containment query uses the selected local change IDs
because remote bookmarks do not exist yet. For an existing stack, repeat it
with `<parent>@$REMOTE` and `<child>@$REMOTE` to verify the published chain. Every
query must return a commit ID for its adjacent pair. If one saved change must be
split, invoke `coding:commit` with the accepted slices. Reserve
`coding:commit --reorder` for an already partitioned chain that needs reordering
or reparenting. After the result is linear, use
`coding:pr create <bottom-change>` for new PRs or
`coding:pr update <bottom-pr-or-head>` for an existing stack. The create/update
workflow owns bookmark placement, leased pushes, PR bases, and the explicit
restack map.

After a lower PR merges, use `coding:pr merge` for the remaining round. Any
merge-induced descendant rebase, bookmark movement, and affected-head batch
publication remain owned by that merge workflow. `coding:commit` owns edit- or
fix-induced rewrites outside the merge operation.

## Inspect with Git

Inspect the candidate chain and branch placement without mutating it:

```bash
git log --reverse --oneline "$REMOTE"/<destination>..<selected-top-ref>
git branch --list '<feature-slug>/*'
git merge-base --is-ancestor <parent-commit> <child-commit>
```

For new publication, use selected local commit IDs. For an existing stack,
repeat the command with `$REMOTE/<parent-head>` and `$REMOTE/<child-head>`.
Every ancestry command must exit zero. If one commit must be split, invoke
`coding:commit` with the accepted slices; use `coding:commit --reorder` only
for an already partitioned chain needing reorder or reparenting. Then use
`coding:pr create <bottom-commit>` for new PRs or
`coding:pr update <bottom-pr-or-head>` for an existing stack. The create/update
workflow owns branch placement,
force-with-lease pushes, PR bases, and the explicit restack map.

After a lower PR merges, use `coding:pr merge` for the remaining round. It
records immutable parent tips and replays only child-exclusive commits with
`git rebase --onto <new-parent> <old-parent-tip> <child>`, then pushes each
remaining head with `--force-with-lease`. Retarget the immediate child's PR to
the destination and verify that base before resuming the next merge round.

## Verify

Before publication and after every restack, confirm:

- each change is independently green;
- branch/bookmark names and PR bases express the same bottom-to-top chain;
- each remote PR head SHA equals the recorded local SHA;
- no merged revision was rewritten;
- every new PR is still draft.

The create/update workflow owns publication and CI convergence; the merge
workflow owns per-round merge and descendant restacking. This reference owns
shape selection and the shared jj/git operator map.
