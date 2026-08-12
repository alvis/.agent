# Partial hunks → chosen branch

Save a subset of `@`'s hunks directly onto a user-chosen existing or new
bookmark without first carving `@` into two jj changes. Sibling to
[workflow-split.md](./workflow-split.md), but the target is an explicitly named
branch rather than a numbered PR-stack bookmark. See [SKILL.md](../SKILL.md)
for the overall pipeline.

## When triggered

- User names a target branch AND asks to save part of `@` (e.g. "land just the typo on master", "commit the doc fix to master and keep the rest on the feature branch").
- One concern in `@` logically belongs to a different existing or new branch.
- Not for numbered stacked-PR bookmark generation. If the user also requests
  a PR, synchronize the chosen target first, then invoke the matching
  [`coding:pr create` or `coding:pr update`](../../pr/references/create-update.md)
  action separately for that exact bookmark.

If `@` mixes concerns but they all belong on the same new change → [workflow-split.md](./workflow-split.md).

## Pre-flight

This route can rewrite history when an existing bookmark moves backward. The
PreToolUse backup hook fires per [SKILL.md](../SKILL.md) Step 1 for that case;
a new bookmark does not rewind history.

```bash
jj bookmark list --all-remotes            # classify target as local, remote, or new
jj log -r '<target>' --no-graph -T 'change_id.short() ++ " " ++ description ++ "\n"' # existing target only
jj diff --stat                             # confirm the partial subset is identifiable
```

If the target is already merged on origin → defer to [workflow-correct-merged.md](./workflow-correct-merged.md).

## Procedure

### 1. Surface the hunk plan

List the files / hunks intended for the target branch. Get user confirmation before staging.

### 2. Stage hunks of interest

```bash
git add -p              # interactive hunk selection
# or: git add <path>... # for whole-file granularity
git diff --cached --stat
```

If `git diff --cached --stat` is empty → abort, no-op.

### 3. Emit the git commit

```bash
git commit -m "<conventional-subject>" -m "<body>"
```

- Conventional Commits subject regex MUST match BEFORE running, per [conventional-commits.md](./conventional-commits.md).
- Compose subject/body using the same rules as [workflow-save-local.md](./workflow-save-local.md) Step 4.
- `--no-verify` only if the user passed it to the skill.

This is the **sanctioned** hand-run `git commit` inside this skill (see Hard Rules carve-out below).

### 4. Import the new git commit into jj

```bash
jj git import
jj log -r '@-' --no-graph -T 'change_id.short() ++ " " ++ description ++ "\n"'
```

Capture the new change id from the second line.

### 5. Set the target bookmark

```bash
# existing local target
jj bookmark move <target> --allow-backwards --to <new-change-id>

# new target
jj bookmark set <target> --revision <new-change-id>
```

- Run exactly one command based on the pre-flight classification.
- `--allow-backwards` is required only when an existing move is non-fast-forward. The skill MUST check (`jj log -r '<target>..<new-change-id>'` vs `jj log -r '<new-change-id>..<target>'`) and confirm with the user before a backward move.
- Outside this route, backward bookmark moves require the explicit
  `--allow-rewrite-merged` consent required by the
  [commit and branch directions](../SKILL.md#commit-and-branch-directions).

### 6. Synchronize the chosen bookmark

After the local bookmark operation and integrity check, fetch and push the exact
target directly. Choose one push based on whether `<target>@origin` exists:

```bash
jj git fetch
jj git push --bookmark <target>             # existing remote target
jj git push --bookmark <target> --allow-new # new remote target
```

Run exactly one push. Do not derive or generate a numbered `pr` bookmark.
An existing tracked bookmark is updated with jj's force-with-lease protection;
a new remote bookmark requires the explicit `--allow-new` form.

### 7. Hand off only when a PR was requested

If the user requested a PR, invoke `coding:pr create` for a new head or
`coding:pr update` for an existing open PR, passing the exact `<target>`
bookmark after direct sync. Do not pass a branch prefix or ask the subcommand to
generate a numbered bookmark. The selected action owns PR publication and CI
convergence. Without a PR request, do not invoke either action.

### 8. Confirm leftover working copy

```bash
jj diff --stat
```

The unstaged hunks remain on `@` untouched — verify they match the user's expectation.

## Verification

The PostToolUse hook fires `verify.sh` after the rewrite ops. Read the `── Integrity Check ──` block per [SKILL.md](../SKILL.md) Verification. `GIT_TREE_MATCH` reflects the new HEAD on the target branch, not `@`.

Run project scripts (unless `--no-verify`):

```bash
npm run lint
npm run test
npm run build
```

## Hard rules carve-out

- This route is the ONE sanctioned use of hand-run `git commit` inside this skill.
- This route is the ONE sanctioned use of `jj bookmark move ... --allow-backwards` without an explicit `--allow-rewrite-merged` flag — the user-named target branch IS the consent.
- This route is one of the TWO sanctioned direct `jj git push` paths in this skill; it pushes only the chosen target bookmark.
- PR titles + bodies still go through `/coding:pr create` or
  `/coding:pr update` if a PR follows.
- All other Hard Rules in [SKILL.md](../SKILL.md) still apply.

## Mandatory follow-ups

- Directly synchronize the chosen target after integrity passes.
- Invoke the matching `coding:pr create` or `coding:pr update` action only if
  the user requested a PR for that exact target.
- Report per [SKILL.md](../SKILL.md) Completion.

## Error / edge cases

| Symptom | Action |
|---|---|
| `git add -p` selected zero hunks | Abort, no-op. |
| `git commit` fails (pre-commit hook) | Surface output; fix; re-run from Step 3. Do NOT `--amend`. |
| Conventional regex fails | Fix subject; re-run from Step 3. Do not bypass. |
| Target bookmark not tracking remote | Push it directly with `jj git push --bookmark <target> --allow-new`. |
| Target already merged on origin | Defer to [workflow-correct-merged.md](./workflow-correct-merged.md). |
| Backward move not desired | Drop `--allow-backwards`; jj rejects the move; reconsider target. |
| Integrity check FAIL | STOP, surface diff, `jj op restore <id>` from [SKILL.md](../SKILL.md) Step 1 to roll back. |
