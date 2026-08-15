# Jujutsu guide

This is the coding plugin's canonical cross-skill source for deciding when and
how to use Jujutsu (`jj`). Coding `SKILL.md` files link here instead of
inlining setup and situation selection. Route-specific references retain exact
transactions, non-`jj` gates, and handoffs where their owning skill needs them.

## Ownership

- `coding:commit` owns every local history mutation: new changes, descriptions,
  splits, edits, squashes, rebases, abandons, and bookmark movement.
- `coding:pr create|update|merge` owns remote publication, PR bases, and CI.
- Other coding skills may inspect `jj` state but must hand mutations to those
  owners.
- Use `jj` when it is installed and functionally colocated with the repository.
  Plain Git remains supported when `jj` is unavailable or colocation cannot be
  established safely.

## Require jj 0.44 or newer

The coding plugin relies on commands and safety flags available in Jujutsu
0.44.0 or newer. Before using `jj`, run `coding:sync-tool --only jj --check`.
If the check fails, run `coding:sync-tool --only jj`, then repeat the check.
Do not approximate a missing command with a mixed Git/`jj` sequence.

## Initialize before work

For an ordinary Git checkout that has not been initialized, run this before
editing:

```bash
jj git init --colocate
```

Prove colocation by comparing the Git HEAD with the parent of the `jj` working
copy; directory names alone are not evidence:

```bash
GIT_HEAD=$(git rev-parse HEAD) || exit $?
JJ_HEAD=$(jj log -r @- --no-graph -T 'commit_id') || exit $?
[ "$GIT_HEAD" = "$JJ_HEAD" ]
```

<IMPORTANT>
A linked Git worktree cannot be initialized in place: current `jj` rejects
`jj git init --colocate` there. Before working in a selected Git worktree, run
that command from the repository's primary Git checkout, then create a
`jj workspace` at the intended revision and work there. Do not begin edits in
an uninitialized linked Git worktree or treat it as a `jj workspace`.
</IMPORTANT>

Use the repository's work-ID and location rules when creating the replacement
workspace:

```bash
jj workspace add ~/.workspaces/<project-root-folder-name>/<work-id> \
  --revision <base-revision>
```

Each `jj` workspace has its own `@` and shares the repository's operation log.
Never edit another workspace's working-copy change. After integration, forget
the registered workspace before removing its directory:

```bash
jj workspace forget <workspace-name>
```

## Working model

- `@` is the working-copy change. Most `jj` commands snapshot the filesystem
  before they run, so a dirty working copy is normal.
- Change IDs survive rewrites; commit IDs do not. Use change IDs while shaping
  local history and exact commit IDs when binding review or publication
  evidence.
- Bookmarks are the Git-facing branch refs. Move only the bookmark owned by the
  selected change or stack.
- Capture the current operation before a rewrite:

```bash
jj op log -n1 --no-graph -T 'self.id().short()'
```

  Restore that operation with `jj op restore <operation-id>` when the owning
  workflow's integrity check requires rollback.

## Situation guide

| Situation | `jj` route | Owning detail |
| --- | --- | --- |
| Inspect current work | `jj status`; `jj diff --stat`; `jj log -r 'visible_heads()'` | `coding:commit` pre-flight |
| Start a change | `jj new <base>` then `jj describe @ -m "<conventional-subject>"` | [local save](../skills/commit/references/workflow-save-local.md) |
| Split mixed work | `jj split` or `jj split <paths>` | [split workflow](../skills/commit/references/workflow-split.md) |
| Interactively reorder or abandon a mutable stack | `jj arrange <revset>` after capturing the operation ID | [arrange mutable history](#arrange-mutable-history) |
| Apply a deterministic formatter or content fixer across revisions | configure `fix.tools`, then run `jj fix -s <revset>` | [fix files across revisions](#fix-files-across-revisions) |
| Advance the closest or named bookmark to a descendant | `jj bookmark advance [<name>] --to <revision>` | [advance bookmarks](#advance-bookmarks) |
| Run a read-only task across revisions | `jj run --ignore-changes --root -r <revision> -- <command>` | [run tasks across revisions](#run-tasks-across-revisions) |
| Fix a review bug in a mutable stacked change | save the stack tip; `jj edit <owning-change>`; fix and verify; `jj edit <saved-tip>`; republish the affected suffix with `coding:pr update` | [stacked review fixes](#fix-a-review-bug-in-a-stack) |
| Distribute retrospective fixes | `jj absorb`, then targeted `jj squash --from @ --into <ancestor>` for leftovers | [retrospective workflow](../skills/commit/references/workflow-retrospective.md) |
| Reorder a stack | `jj rebase --insert-before` or `--insert-after` through `coding:commit` | [reorder workflow](../skills/commit/references/workflow-reorder.md) |
| Work in parallel | `jj workspace add` from a shared initialized repository | [parallel workflow](../skills/commit/references/workflow-parallel.md) |
| Remove a truly empty change | `jj abandon <change>` after proving it is empty | [empty-change scenario](../skills/commit/references/scenario-empty-changes.md) |
| Resolve a divergent change ID | inspect both sides, preserve unique content, then abandon only the redundant side | [divergence scenario](../skills/commit/references/scenario-divergent.md) |
| Correct already-merged work | create a corrective change unless explicit authority permits rewriting shared history | [merged-change workflow](../skills/commit/references/workflow-correct-merged.md) |
| Move selected hunks to an existing branch | use the scoped partial-to-branch route; do not improvise a mixed Git/`jj` sequence | [partial-to-branch workflow](../skills/commit/references/workflow-partial-to-branch.md) |
| Publish a change or stack | move only selected bookmarks and hand off to `coding:pr create|update` | [PR publication](../skills/pr/references/create-update.md) |
| Merge a stack | merge bottom-up and let `coding:pr merge` repair remaining topology | [PR merge](../skills/pr/references/merge.md) |
| Retire stale state | inventory registered workspaces and changes; preserve anything dirty, divergent, unreachable, or unproved | `coding:cleanup` |

## Arrange mutable history

Use `jj arrange` when a human needs a visual, interactive reordering or
abandonment pass over an already partitioned mutable stack:

```bash
jj op log -n1 --no-graph -T 'self.id().short()'
jj arrange '<root-change>::<stack-tip>'
```

This rewrites history and therefore belongs to `coding:commit`. Keep immutable
or merged revisions outside the selected revset. After the TUI exits, inspect
the graph, conflicts, descriptions, and content equivalence before accepting
the operation. Prefer explicit `jj rebase --insert-before` or
`--insert-after` when the desired order is already known or execution is
non-interactive.

## Fix files across revisions

Use `jj fix` for deterministic stdin-to-stdout tools such as Prettier. Define
the tool once in repository configuration; this example resolves the
repository-local Prettier executable through pnpm and preserves filename-aware
parsing:

```toml
[fix.tools.prettier]
command = ["pnpm", "--dir=$root", "exec", "prettier", "--stdin-filepath=$path"]
patterns = [
  "glob:'**/*.js'",
  "glob:'**/*.jsx'",
  "glob:'**/*.ts'",
  "glob:'**/*.tsx'",
  "glob:'**/*.json'",
  "glob:'**/*.md'",
  "glob:'**/*.yaml'",
  "glob:'**/*.yml'",
]
```

`jj fix -s` also rewrites every descendant of each source revision. First prove
that the source's mutable descendant set contains only the stack you intend to
rewrite:

```bash
jj op log -n1 --no-graph -T 'self.id().short()'
jj log -r '<earliest-change>:: & mutable()'
jj fix -s '<earliest-change>' --all-lines
jj op show -p
```

`jj fix` rewrites matching revisions and descendants, deduplicates identical
file contents, and saves output only from tools that exit successfully. Tools
must therefore be deterministic and must read stdin and write the replacement
to stdout. If the inspected descendant set includes an unrelated change, stop
and isolate the intended history instead of using that source. Run the rewrite
through `coding:commit`, inspect the operation diff, and rerun the affected
tests before publication.

## Advance bookmarks

Use `jj bookmark advance` when a bookmark already behind a selected descendant
should move forward without spelling out its current revision:

```bash
jj bookmark list
jj bookmark advance feature/01-api --to <descendant-change>
jj bookmark list feature/01-api
```

With no bookmark name, the command advances the closest bookmarks reachable
from the target (which defaults to `@`). Name each bookmark explicitly in
publication-sensitive work so an adjacent bookmark cannot move accidentally.
The command moves only forward; sideways or backwards movement needs a
different, explicitly authorized route. Bookmark mutation belongs to
`coding:commit`; remote publication still belongs to `coding:pr`.

## Run tasks across revisions

Use `jj run` to execute the same command in isolated working copies without
moving the current workspace:

```bash
jj run --ignore-changes --root -r '<revision>' -- <test-or-lint-command>
```

`--ignore-changes` is mandatory for validation because `jj run` otherwise
amends successful revisions with command output. Add `--clean` when cached
ignored artifacts could invalidate the result. Run one exact revision per
invocation when result order or bookmark attribution matters; `JJ_CHANGE_ID`,
`JJ_COMMIT_ID`, and `JJ_WORKSPACE_ROOT` identify the active surface.

Higher-level workflows own the revision set, execution order, failure
attribution, and any explicit skip. Follow their reference instead of choosing
an ad hoc revset or inferring a skip from another flag.

`coding:pr create|update` requires this runner for its local publication gate:
it validates the selected tip first, then each PR bookmark bottom-up through the
tip. It stops at the earliest failing surface so the owning bookmark/PR is fixed
before publication. Only that action's explicit `--no-verify` skips the gate.

## Fix a review bug in a stack

When review finds a bug in stacked commits, stacked branches, or stacked PRs,
repair the earliest mutable change that owns the faulty artifact. Do not append
an unrelated fix at the tip merely to avoid rewriting the unmerged stack.

1. Resolve and inspect the owning change and its descendants. Record the
   current stack-tip change ID before switching revisions.
2. Confirm it is mutable and not merged into the destination.
3. Capture the current operation ID.
4. Run `jj edit <owning-change>`.
5. Apply the bug fix and run the focused validation while `@` is that change.
6. Run `jj edit <saved-stack-tip-change-id>` to return `@` to the automatically
   rebased stack tip. If the owning change was already the tip, remain there.
   Use `jj new <saved-stack-tip-change-id>` only when the caller deliberately
   needs a new change above the completed stack.
7. Verify the repaired chain, then invoke `coding:pr update` for every affected
   PR from the edited change through the stack tip.

If the target is immutable or already merged, stop using `jj edit` and take the
corrective-change route. If fixes belong to multiple ancestors, use the
retrospective route instead of serial edits.

## Work in parallel

Use a parallel workspace only when the new task has no file or semantic
dependency on the current `@`. Shared files or required ordering stay in the
current workspace and are split later if needed.

1. Record the default workspace's current change ID and inspect visible heads.
2. Reuse the selected work ID and create the workspace with `jj workspace add`
   at the intended base revision.
3. Work only from the new directory's own `@`; never reach across workspaces
   with `jj edit`.
4. Finish with one of these explicit dispositions:
   - keep the parallel change independent and publish it separately;
   - integrate it above the default change with
     `jj rebase -s <parallel-change> -d <default-change>`; or
   - create an intentional merge change with
     `jj new <default-change> <parallel-change>`.
5. Verify the resulting graph. Once the workspace has no remaining independent
   work, run `jj workspace forget <workspace-name>`, verify it is no longer
   registered, then remove its directory through the cleanup owner.

If `jj workspace add` cannot resolve the base, fetch the selected remote and
retry only after confirming the exact revision. If two workspaces edited the
same change ID, stop normal integration and use the divergence route.

## Command reference

### Changes and content

| Command | Purpose |
| --- | --- |
| `jj new [<rev>...]` | Create a new empty change, optionally on selected parent revisions. |
| `jj edit <change>` | Make a mutable existing change the working-copy change. Required for a review fix owned by one stacked change. |
| `jj describe <rev> -m "<message>"` | Set the change description. |
| `jj split [<paths>]` | Split the current change interactively or by path. |
| `jj squash --from <src> --into <dst> [<paths>]` | Move all or selected content into an ancestor. |
| `jj absorb [-i] [<paths>]` | Distribute matching working-copy changes into mutable ancestors. |
| `jj abandon <rev>` | Remove a change from visible history and rebase descendants. |
| `jj arrange [<revset>...]` | Interactively reorder or abandon selected mutable revisions. |
| `jj fix -s <revset> [<fileset>...]` | Rewrite matching file versions through configured deterministic tools. |
| `jj run --ignore-changes -r <revset> -- <command>` | Run a read-only command in isolated revision working copies. |

### Stack and refs

| Command | Purpose |
| --- | --- |
| `jj rebase -s <src> -d <dst>` | Move a change and its descendants. |
| `jj rebase -r <rev> --insert-before <other>` | Insert one revision before another. |
| `jj rebase -r <rev> --insert-after <other>` | Insert one revision after another. |
| `jj bookmark list` | Inspect local and tracked bookmarks. |
| `jj bookmark set <name> --revision <rev>` | Create or move the selected bookmark. |
| `jj bookmark move <name> --to <rev>` | Fast-forward an existing bookmark. |
| `jj bookmark advance [<name>...] --to <rev>` | Advance the closest or named bookmarks to a descendant revision. |
| `jj bookmark forget <name>` | Remove a local bookmark without deleting commits. |

### Git interoperation and publication

| Command | Purpose |
| --- | --- |
| `jj git fetch --remote <remote>` | Refresh the selected remote's refs. |
| `jj git import` | Import refs after an explicitly authorized Git-side operation. |
| `jj git push --remote <remote> --bookmark <name>` | Publish one selected bookmark through the PR workflow. |

Never use `--all` for routine publication. Push all and only the bookmarks
selected by the PR workflow, then verify every remote head and PR base.

### Inspection and recovery

| Command | Purpose |
| --- | --- |
| `jj log -r '<revset>'` | Inspect the exact change or stack surface. |
| `jj diff [--from <a> --to <b>]` | Inspect current or revision-to-revision content. |
| `jj file annotate -r <rev> <file>` | Attribute lines before a retrospective fix. |
| `jj op log` | Inspect history-shaping operations. |
| `jj op restore <operation-id>` | Restore `jj` repository state to a captured operation. |
| `jj workspace list` | Inventory registered `jj` workspaces. |

After every rewrite, verify the stack is linear, conflict-free, and
self-contained; run the affected lint, type, test, and build gates before
publication.
