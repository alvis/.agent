# jj v0.40+ cheatsheet (commands used by `/coding:commit`)

One-line reference for every jj primitive this skill uses, with the closest git equivalent. See [SKILL.md](../SKILL.md).

## Core change ops

| jj | Purpose | git equivalent |
|---|---|---|
| `jj new` | Create a fresh empty change on top of `@` | `git checkout -b temp` (loosely; jj keeps history linear) |
| `jj new <rev>` | Create a fresh empty change on top of `<rev>` | `git checkout <rev> && git checkout -b temp` |
| `jj new <c1> <c2>` | Create a merge change with two parents | `git merge <c2>` from `<c1>` |
| `jj edit <change>` | Switch `@` to `<change>` and amend it directly | `git rebase -i` + `edit` |
| `jj describe <rev> -m "<msg>"` | Set / replace the description of `<rev>` | `git commit --amend -m "<msg>"` |
| `jj abandon <rev>` | Remove `<rev>` from the visible history; auto-rebases descendants | `git rebase --onto <parent> <rev>^ <rev>` |

## Splitting and squashing

| jj | Purpose | git equivalent |
|---|---|---|
| `jj split` | Open editor to split current change by hunks | `git reset HEAD~ && git add -p && git commit` (×N) |
| `jj split <files>` | Carve named files into a new change at `@-` | n/a — closest: `git reset` + selective `git add` |
| `jj squash` | Squash `@` into `@-` | `git commit --amend` for parent |
| `jj squash --from <src> --into <dst>` | Move all hunks from `<src>` into `<dst>` | `git rebase -i` + fixup |
| `jj squash --from <src> --into <dst> <path>` | Move only `<path>` hunks | n/a — hand-curated rebase |
| `jj absorb` | Auto-distribute `@` hunks into matching ancestors | `git absorb` (third-party) or manual fixup rebase |
| `jj absorb -i` | Interactive absorb selection | n/a |
| `jj absorb <path>` | Scope absorb to one file/path | n/a |

## Rebasing

| jj | Purpose | git equivalent |
|---|---|---|
| `jj rebase -s <src> -d <dst>` | Move `<src>` + descendants onto `<dst>` | `git rebase --onto <dst> <src>^ <branch>` |
| `jj rebase -r <rev> -d <dst>` | Move only `<rev>` (not descendants) onto `<dst>` | n/a — much harder in pure git |
| `jj rebase -r <rev> --insert-before <other>` | Place `<rev>` immediately before `<other>` | hand-crafted `git rebase -i` reorder |
| `jj rebase -r <rev> --insert-after <other>` | Place `<rev>` immediately after `<other>` | hand-crafted `git rebase -i` reorder |
| `jj rebase -b <bookmark> -d main@origin` | Rebase a bookmark's entire chain onto remote main | `git rebase main` on the branch |

## Bookmarks (git branches)

| jj | Purpose | git equivalent |
|---|---|---|
| `jj bookmark set <name> --revision <rev>` | Move/create bookmark pointing at `<rev>` | `git branch -f <name> <rev>` |
| `jj bookmark move <name> --to <rev>` | Move existing bookmark to `<rev>` (fast-forward only) | `git branch -f <name> <rev>` |
| `jj bookmark move <name> --allow-backwards --to <rev>` | Move existing bookmark to `<rev>`; `--allow-backwards` permits non-fast-forward moves (e.g. landing partial hunks onto `master` via `workflow-partial-to-branch.md`) | `git branch -f <name> <rev>` (with force) |
| `jj bookmark list` | List local bookmarks | `git branch --list` |
| `jj bookmark list -r '<revset>'` | List bookmarks within revset | n/a |
| `jj bookmark forget <name>` | Drop local bookmark without affecting commits | `git branch -d <name>` |

## Remote / git

| jj | Purpose | git equivalent |
|---|---|---|
| `jj git fetch` | Fetch all remotes; updates `main@origin` etc. | `git fetch --all` |
| `jj git import` | Re-read git refs after external git ops (esp. after a hand-run `git commit` made via `git add -p` to land partial hunks) | n/a (automatic in pure git) |
| `jj git push --bookmark <name>` | Lease-protected direct sync for the authorized correct-merged bookmark or an existing partial-to-branch target | `git push --force-with-lease origin <name>` |
| `jj git push --bookmark <name> --allow-new` | Create the explicitly chosen new partial-to-branch target on origin | `git push -u origin <name>` |

These two direct bookmark-sync routes are the only remote exception in this
skill. PR publication, repair, and CI convergence route to `coding:pr create`.

## Logs and revsets

| jj | Purpose | git equivalent |
|---|---|---|
| `jj log` | Render history graph | `git log --graph` |
| `jj log -r '<revset>'` | Filter by revset | `git log <ref>..<ref>` |
| `jj log -r '@-..@'` | Just the current change | n/a |
| `jj log -r '(target..@)::'` | Range from `<target>` to `@` plus descendants | `git log <target>..HEAD` |
| `jj log -r 'visible_heads()'` | All open tips | `git branch --all` (loosely) |
| `jj log -r 'change_id(<id>)'` | Find all commits matching change id (divergent check) | n/a |
| `jj diff` | Show working-copy / change diff | `git diff` |
| `jj diff --stat` | File + LOC summary | `git diff --stat` |
| `jj diff --name-only` | File list only | `git diff --name-only` |
| `jj diff --from <a> --to <b>` | Diff between two revisions | `git diff <a>..<b>` |
| `jj blame <rev> <file>` | Per-line authorship (jj-native blame) | `git blame <rev> -- <file>` |
| `jj blame <rev> <file> -L <s>,<e>` | Scoped blame | `git blame -L <s>,<e>` |

## Operation log (history of history)

| jj | Purpose | git equivalent |
|---|---|---|
| `jj op log` | Full op history (every jj action) | `git reflog` (loosely) |
| `jj op log -n1 --no-graph -T 'self.id().short()'` | Capture current op id for rollback | n/a |
| `jj op restore <id>` | Undo back to op `<id>` (rewinds jj state ONLY, not filesystem) | `git reflog` + `git reset` |

## Workspaces

| jj | Purpose | git equivalent |
|---|---|---|
| `jj workspace add ~/.workspaces/<project-root-folder-name>/<work-id> --revision <rev>` | Create parallel workspace at `<rev>` (default location; reuse the work ID) | `git worktree add ~/.workspaces/<project-root-folder-name>/<work-id> <rev>` (NOT equivalent — see [workflow-parallel.md](./workflow-parallel.md)) |
| `jj workspace list` | List all jj workspaces | `git worktree list` |
| `jj workspace forget <name>` | Drop a workspace from the op log | `git worktree remove` (with caveats) |

## Templates (v0.40+)

| Template | Purpose |
|---|---|
| `new_description` | Default description template for new changes |
| `builtin_draft_commit_description_with_diff` | Editor template showing diff under description |
| `-T '<expr>'` | Inline template, e.g. `-T 'change_id.short() ++ " " ++ description'` |

## Commands NOT used by this skill (anti-patterns)

- `jj squash -i` — interactive squash; prefer explicit `--from`/`--into` for determinism.
- `git rebase -i` — git interactive rebase. jj owns rewrite; git is downstream.
- Remote publication commands outside the two explicit direct-sync routes — `coding:pr create` owns them.
- `git commit --amend` — jj `edit` + `describe` is the equivalent.
- `git checkout` — jj `new` / `jj edit` is the equivalent for changing `@`.
