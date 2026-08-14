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
  a PR, synchronize the chosen target first, then return the exact bookmark and
  any open-PR metadata. A separately authorized `coding:pr create` or
  `coding:pr update` action owns every later PR mutation.

If `@` mixes concerns but they all belong on the same new change → [workflow-split.md](./workflow-split.md).

## Pre-flight

This route can rewrite history when an existing bookmark moves backward. The
PreToolUse backup hook fires per [SKILL.md](../SKILL.md) Step 1 for that case;
a new bookmark does not rewind history.

```bash
jj git fetch
jj bookmark list --all-remotes            # classify target as local, remote, or new
jj log -r '<target>' --no-graph -T 'change_id.short() ++ " " ++ description ++ "\n"' # existing target only
jj diff --stat                             # confirm the partial subset is identifiable

TARGET_CREATION_BASE=$(git rev-parse HEAD)
LOCAL_TARGET_SHA=$(jj log -r '<target>' --no-graph -T 'commit_id') || \
  LOCAL_TARGET_SHA=
REMOTE_TARGET_SHA=$(jj log -r '<target>@origin' --no-graph -T 'commit_id') || \
  REMOTE_TARGET_SHA=
```

Bind the route and immutable parity base before any staging, bookmark move, or
creation. Classify local and remote bookmark state independently:

- A remote-only target is bound to its fetched remote SHA; create its missing
  local bookmark at that SHA before moving it.
- A local-only target is bound to its local SHA and later requires an
  `--allow-new` push.
- Synchronized local and remote targets are bound to their shared SHA; reuse
  and move the existing local bookmark.
- Divergent local and remote targets have no safe parity base; stop before
  staging or mutation.

Every non-divergent existing target is safe only when the partial commit will
be created directly on its bound SHA. A target absent both locally and remotely
is new and remains bound to the current `HEAD` creation base:

```bash
case "$REMOTE_TARGET_SHA" in
  "")
    case "$LOCAL_TARGET_SHA" in
      "")
        TARGET_ROUTE=new-target
        TARGET_BASE=$TARGET_CREATION_BASE
        ;;
      *)
        if test "$TARGET_CREATION_BASE" != "$LOCAL_TARGET_SHA"; then
          printf '%s\n' 'HEAD must equal local target before partial commit' >&2
          exit 1
        fi
        TARGET_ROUTE=local-only
        TARGET_BASE=$LOCAL_TARGET_SHA
        ;;
    esac
    ;;
  *)
    if test -n "$LOCAL_TARGET_SHA"; then
      if test "$LOCAL_TARGET_SHA" != "$REMOTE_TARGET_SHA"; then
        printf '%s\n' \
          'local and remote target bookmarks diverge; reconcile before partial commit' >&2
        exit 1
      fi
      if test "$TARGET_CREATION_BASE" != "$LOCAL_TARGET_SHA"; then
        printf '%s\n' \
          'HEAD must equal synchronized target before partial commit' >&2
        exit 1
      fi
      TARGET_ROUTE=synchronized
      TARGET_BASE=$LOCAL_TARGET_SHA
    else
      if test "$TARGET_CREATION_BASE" != "$REMOTE_TARGET_SHA"; then
        printf '%s\n' 'HEAD must equal fetched target before partial commit' >&2
        exit 1
      fi
      TARGET_ROUTE=remote-only
      TARGET_BASE=$REMOTE_TARGET_SHA
    fi
    ;;
esac
test -n "$TARGET_BASE"
printf 'TARGET_ROUTE=%s\nTARGET_BASE=%s\n' "$TARGET_ROUTE" "$TARGET_BASE"
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
case "$TARGET_ROUTE" in
  remote-only)
    jj bookmark create <target> --revision "$REMOTE_TARGET_SHA"
    jj bookmark move <target> --to <new-change-id>
    ;;
  local-only|synchronized)
    jj bookmark move <target> --to <new-change-id>
    ;;
  new-target)
    jj bookmark set <target> --revision <new-change-id>
    ;;
  *)
    exit 3
    ;;
esac
```

- Run exactly the classified branch. For `remote-only`, create the missing
  local bookmark at the fetched SHA before moving it to the new descendant;
  this preserves the fetched lease state for the later scoped push.
- For `local-only` and `synchronized`, reuse and move the existing local
  bookmark. The pre-flight `HEAD` equality guard makes the new commit a
  descendant of the bound target, so neither route permits a backward move.

### 6. Synchronize the chosen bookmark

After the local bookmark operation and integrity check, fetch remote state
again and require the pre-flight classification to remain current. A changed or
newly created remote target restarts pre-flight and invalidates parity evidence:

```bash
jj git fetch
CURRENT_REMOTE_SHA=$(jj log -r '<target>@origin' --no-graph -T 'commit_id') || \
  CURRENT_REMOTE_SHA=
test "$CURRENT_REMOTE_SHA" = "$REMOTE_TARGET_SHA" || exit 2
```

Before any push, bind `TARGET_SHA` to the new bookmark's exact Git commit;
`TARGET_BASE` remains the pre-flight local target, remote target, shared target,
or creation base selected by the route:

```bash
TARGET_SHA=$(jj log -r <new-change-id> --no-graph -T 'commit_id')
TARGET_KIND=standalone
```

Invoke the public parity action for this standalone surface:

```text
coding:pr verify --target "$TARGET_SHA" --base "$TARGET_BASE" --kind "$TARGET_KIND"
```

Capture the action's complete `CI_PARITY_RECEIPT_JSON`, its canonical
`CI_PARITY_EXPECTED_WORKFLOW_COMMAND_RESULTS_JSON`, and its canonical
`CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON`, then consume them before the
push:

```bash
RECEIPT_TARGET_SHA=$(jq -er \
  '.target.sha | select(type == "string" and length > 0)' \
  <<<"$CI_PARITY_RECEIPT_JSON") || exit 42
RECEIPT_TARGET_BASE=$(jq -er \
  '.target.base | select(type == "string" and length > 0)' \
  <<<"$CI_PARITY_RECEIPT_JSON") || exit 42
RECEIPT_TARGET_KIND=$(jq -er \
  '.target.kind | select(type == "string" and length > 0)' \
  <<<"$CI_PARITY_RECEIPT_JSON") || exit 42
RECEIPT_APPLICABILITY_MODE=$(jq -er \
  '.applicability_mode | select(type == "string" and length > 0)' \
  <<<"$CI_PARITY_RECEIPT_JSON") || exit 42
RECEIPT_COMMAND_RESULTS_JSON=$(jq -ecS \
  '.workflow_command_results | select(type == "array")' \
  <<<"$CI_PARITY_RECEIPT_JSON") || exit 42
EXPECTED_COMMAND_RESULTS_JSON=$(jq -ecS \
  'select(type == "array")' \
  <<<"$CI_PARITY_EXPECTED_WORKFLOW_COMMAND_RESULTS_JSON") || exit 42
test "$RECEIPT_TARGET_SHA" = "$TARGET_SHA" || exit 42
test "$RECEIPT_TARGET_BASE" = "$TARGET_BASE" || exit 42
test "$RECEIPT_TARGET_KIND" = "$TARGET_KIND" || exit 42
test "$RECEIPT_APPLICABILITY_MODE" = conservative_pull_request || exit 42
test "$RECEIPT_COMMAND_RESULTS_JSON" = "$EXPECTED_COMMAND_RESULTS_JSON" || exit 42

RECEIPT_OVERALL=$(jq -er '.overall | select(type == "string")' \
  <<<"$CI_PARITY_RECEIPT_JSON") || exit 42
CANONICAL_EXPECTED_SECRET_NAMES_JSON=$(jq -ec \
  'select(type == "array" and . == (sort | unique))' \
  <<<"$CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON") || exit 42
CANONICAL_RECEIPT_SECRET_NAMES_JSON=$(jq -ec \
  '.missing_secret_approval.names
   | select(type == "array" and . == (sort | unique))' \
  <<<"$CI_PARITY_RECEIPT_JSON") || exit 42
test "$CANONICAL_RECEIPT_SECRET_NAMES_JSON" = \
  "$CANONICAL_EXPECTED_SECRET_NAMES_JSON" || exit 42
case "$RECEIPT_OVERALL" in
  pass)
    test "$CANONICAL_EXPECTED_SECRET_NAMES_JSON" = '[]' || exit 42
    jq -e 'all(.workflow_command_results[];
      (.status | type) == "number" and .status == 0)' \
      <<<"$CI_PARITY_RECEIPT_JSON" >/dev/null || exit 42
    jq -e '.missing_secret_approval == {
      "approved": false, "names": [], "sha": null
    }' <<<"$CI_PARITY_RECEIPT_JSON" >/dev/null || exit 42
    ;;
  approved_without_local_run)
    EXPECTED_SECRET_NAMES_JSON=$(jq -ec \
      'select(type == "array" and length > 0)
       | select(all(.[]; type == "string" and length > 0))
       | select(. == (sort | unique))' \
      <<<"$CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON") || exit 42
    RECEIPT_SECRET_NAMES_JSON=$(jq -ec \
      '.missing_secret_approval.names
       | select(type == "array" and length > 0)
       | select(all(.[]; type == "string" and length > 0))
       | select(. == (sort | unique))' \
      <<<"$CI_PARITY_RECEIPT_JSON") || exit 42
    test "$(jq -er '.missing_secret_approval.approved' \
      <<<"$CI_PARITY_RECEIPT_JSON")" = true || exit 42
    test "$(jq -er '.missing_secret_approval.sha' \
      <<<"$CI_PARITY_RECEIPT_JSON")" = "$TARGET_SHA" || exit 42
    test "$RECEIPT_SECRET_NAMES_JSON" = "$EXPECTED_SECRET_NAMES_JSON" || exit 42
    jq -e 'all(.workflow_command_results[];
      .status == "not_run_missing_secret")' \
      <<<"$CI_PARITY_RECEIPT_JSON" >/dev/null || exit 42
    ;;
  *)
    exit 42
    ;;
esac
printf 'CI_PARITY_RECEIPT_GATE=accepted\n'
```

On the exception path, its `sha` equals the exact `TARGET_SHA` and its `names`
equal the verifier's exact lexically sorted missing-secret names. A SHA-only
approval or any name/order mismatch cannot form a complete receipt and stops
before the push. `--no-verify` does not skip this gate. This is a direct
bookmark sync, not PR publication; do not invoke a publication action.

Choose one push from `TARGET_ROUTE`; an unknown route stops without publishing:

```bash
case "$TARGET_ROUTE" in
  remote-only|synchronized)
    jj git push --bookmark <target>
    ;;
  local-only|new-target)
    jj git push --bookmark <target> --allow-new
    ;;
  *)
    exit 3
    ;;
esac
```

Run exactly one matching push. Do not derive or generate a numbered `pr` bookmark.
A remote-only or synchronized remote bookmark is updated with jj's
force-with-lease protection. A local-only or genuinely new bookmark requires
the explicit `--allow-new` form after its route-specific base guard passes.

### 7. Return PR handoff metadata when requested

If the user requested a PR, return the exact synchronized `<target>` bookmark
and any matching open PR number, URL, head, and base. Do not mutate a PR or
dispatch another action. The caller must separately authorize the matching
`coding:pr create` or `coding:pr update` action.

### 8. Confirm leftover working copy

```bash
jj diff --stat
```

The unstaged hunks remain on `@` untouched — verify they match the user's expectation.

## Verification

The PostToolUse hook fires `verify.sh` after the rewrite ops. Read the `── Integrity Check ──` block per [SKILL.md](../SKILL.md) Verification. `GIT_TREE_MATCH` reflects the new HEAD on the target branch, not `@`.

Run ordinary project scripts (unless `--no-verify`):

```bash
npm run lint
npm run test
npm run build
```

These checks do not replace the exact-revision publication gate in Step 6,
which `--no-verify` cannot skip.

## Hard rules carve-out

- This route is the ONE sanctioned use of hand-run `git commit` inside this skill.
- This route is one of the TWO sanctioned direct `jj git push` paths in this skill; it pushes only the chosen target bookmark.
- PR titles, bodies, and mutations remain with a separately authorized
  `coding:pr` action; this route returns bookmark and PR metadata only.
- All other Hard Rules in [SKILL.md](../SKILL.md) still apply.

## Mandatory follow-ups

- Directly synchronize the chosen target after integrity passes.
- Return the exact bookmark and PR metadata requested for a later, separately
  authorized `coding:pr create` or `coding:pr update` action.
- Report per [SKILL.md](../SKILL.md) Completion.

## Error / edge cases

| Symptom | Action |
|---|---|
| `git add -p` selected zero hunks | Abort, no-op. |
| `git commit` fails (pre-commit hook) | Surface output; fix; re-run from Step 3. Do NOT `--amend`. |
| Conventional regex fails | Fix subject; re-run from Step 3. Do not bypass. |
| Target bookmark exists only remotely | Require HEAD to equal its fetched remote SHA, create the local bookmark at that SHA, then move and push it without `--allow-new`. |
| Target bookmark exists only locally | Require HEAD to equal its bound local SHA before staging, then push with `jj git push --bookmark <target> --allow-new`. |
| Local and remote target bookmarks are synchronized | Require HEAD to equal their shared SHA, reuse and move the local bookmark, then push it without `--allow-new`. |
| Local and remote target bookmarks diverge | Stop before staging or mutation; reconcile the bookmark state and restart pre-flight. |
| Target already merged on origin | Defer to [workflow-correct-merged.md](./workflow-correct-merged.md). |
| Integrity check FAIL | STOP, surface diff, `jj op restore <id>` from [SKILL.md](../SKILL.md) Step 1 to roll back. |
