# Create or Update Pull Requests

Load the complete workflow from `coding:pr create` or `coding:pr update`;
`coding:pr author` loads only [Author the PR text](#author-the-pr-text). Turn
one saved change or stack into live, green draft PRs. This workflow composes
deterministic Conventional Commits PR text, publishes bottom-up, and owns hosted
CI until green or blocked. Repair obeys the **Coherence Mandate**: produce one
continuous work; rewrite over restructure, restructure over integrate, never
append. Dissolve new content into the existing structure. Visible seams,
parallel paths, addenda, vestigial helpers, and tack-ons are forbidden.

Reviewers own size-standard findings and reviewability judgments. This workflow
owns pull-request authoring and publication directions, deterministic zone
calculation, and the gates below. Scan each implementation diff and rendered PR
body against `coding:standards/git/`; [message.md](../templates/message.md) owns
the bundled body shape.

## Pull-request directions

- Format the title as a Conventional Commit subject.
- Open every human-authored PR as a draft. A documented incident may authorize
  a hotfix exception; automated dependency or generator PRs follow their
  platform configuration.
- Use a repository-local PR template when present; otherwise render
  [message.md](../templates/message.md). Keep labels and size bookkeeping out
  of the title and body.
- Bind authoring and review evidence to the exact head and base OIDs. Reset
  reviewer evidence when either OID changes; preserve it on a no-op retry.
- Make each PR independently valid and reviewable. Keep its tests and generated
  outputs with the implementation that needs them.
- Leave draft only after CI passes, the author self-reviews the diff, the body
  passes its selected-template scan, and every lower stack PR has merged or is
  also ready. A materially expanded surface returns to draft; notify reviewers
  when they need the changed context.

### Select the PR archetype

Select the one archetype that best describes the implementation surface.
Archetype classification is independent of labels: it drives conditional PR-body
evidence and scanner behavior only.

| Surface | Archetype |
|---|---|
| Design proposal without production code | `rfc` |
| Types, interfaces, schemas, or JSDoc-only API shape | `code-spec` |
| External API, IPC, or wire format | `contract` |
| Pure entities, value objects, invariants, and unit tests | `domain-model` |
| Business behavior fulfilling an existing shape | `implementation` |
| Module wiring, adapters, dependency injection, or end-to-end tests | `integration` |
| Add, flip, or remove a feature flag | `feature-flag` |
| Schema migration, backfill, or config-format upgrade | `migration` |
| User-facing visual or interaction change | `ui` |
| Rename, move, codemod, formatting sweep, or pure restructuring | `mechanical-refactor` |
| Dead-code, deprecation, or lint-debt removal | `cleanup` |
| Logs, metrics, traces, dashboards, alerts, or instrumentation | `observability` |

## Boundaries

- Use `ACTION=create` to compose a PR title and body, publish a new saved change
  or ordered stack as draft PRs, and monitor every GitHub check through repair.
  `coding:commit --create-pr` reaches this action through its required handoff.
- Use `ACTION=update` to republish an existing draft PR or stack, refresh its
  title, body, and bases, and monitor every GitHub check through repair.
- Do not use for: saving work without publication (`coding:commit`), reviewing
  code, merging PRs (`coding:pr merge`), or creating a new stack solely by
  reshaping local history (`coding:commit --reorder`).
- Multi-template directories (`.github/PULL_REQUEST_TEMPLATE/*.md`) are
  intentionally ignored — selecting between them is a human choice and out of
  scope.
- Delegate noisy commands to one small read-only tester before publication and
  one small read-oriented poller after publication, following the repository
  delegation contract at `governance:standards/delegation/`.

<IMPORTANT>
- Ownership is singular: `coding:commit` owns direct history mutations;
  its `--reorder` workflow owns reshaping/reparenting when a root cause belongs
  in a lower PR outside the current PR; the core publication phase below owns
  batch push, restack, and PR-base mechanics. The parent alone accepts
  fixer edits and performs commit, push, and restack mutations; the poller may
  dispatch exactly one scoped fixer when the red branch requires it.
- Before every push, verify the standalone selected head or the selected
  stack's tip locally at its exact Git SHA with the test and lint commands from
  the applicable `pull_request` GitHub Actions workflows at that revision. A
  missing required secret is the only exception: stop and ask the user either
  to supply it from an explicit source or to approve pushing that exact SHA
  without the local run for the exact lexically sorted missing-secret names.
  Never infer approval from another flag or caller, guess a secret source, pass
  an empty value, or push after any other local failure.
- `--no-review` skips only remote PR review dispatch and comment convergence.
  It never skips local checks or hosted CI.
- `--publish-only` returns after leased pushes, metadata updates, and head/base
  verification. It skips review and CI because its caller owns convergence.
- Fix root causes. MUST NOT weaken a correct test, alter a valid expectation,
  add ignores/suppressions, or delete checks merely to pass. Edit a test only
  when captured failure evidence proves the test itself is the root cause.
- Never report success while any PR in the resulting stack is pending or red.
</IMPORTANT>

## Inputs

- **Required**: `ACTION=create|update`, supplied by the router. `create` defaults
  to the current saved change — the jj working-copy change (`@`), or `HEAD` on
  the git path — and includes ordered unmerged descendants when they form a
  stack. `update` requires an open PR number/URL, a ref whose head has an open
  PR, or an unambiguous current branch with an open PR.
- **Optional**:

| Input | Effect |
|---|---|
| `<commit-ref>` | Publish a resolvable jj change ID/revset/bookmark or git branch/SHA and its selected stack. Any jj revset (`@`, `@-`, a change id) or git ref (`HEAD`, `HEAD~1`, a SHA) also selects the commit to author from; behavior is deterministic given the ref. |
| `--branch-prefix <name>` | Override the derived stack bookmark prefix. A prefix other than a resolved stream's `<type>/<work-id>` publishes a branch that will not resolve back to its work state — expected for a branch predating that convention, deliberate otherwise. |
| `--remote <name>` | Select the named push remote explicitly; remote names are treated as values even when they begin with `-`. |
| `--no-review` | Skip the post-push `coding:pr review` convergence loop. It never skips local checks, publication, or hosted CI. |
| `--publish-only` | Stop after the verified core publication phase so an existing review or repair caller can continue its convergence loop. |
| `--dry-run` | Print the test, publication, and monitoring plan without agents or local/remote mutations. |

- **Prerequisites**: for publication — a clean saved change or linear stack,
  authenticated `gh`, and remote push access. `jj` is preferred and drives
  publication whenever it is both installed on PATH and initialized for this
  repository; prove that functionally rather than by directory presence, since a
  `.jj` and a `.git` directory can both exist without sharing a backing
  repository. Confirm `git rev-parse HEAD` equals
  `jj log -r @- --no-graph -T 'commit_id'`; anything else — `jj` missing, either
  command failing, or the two ids differing — selects the git path, which is
  fully supported and never requires initializing `jj`. Authoring PR text alone
  needs neither, so the text-only path is never blocked by the publication
  prerequisites.

## State gate

Before creating or materially rewriting a project artifact, read the absolute
`state.md` path injected by Essential. If unavailable, stop artifact
writes and report the missing contract. Publication-only runs may proceed
without creating work artifacts; before any red-CI repair, run the resolver,
ask only on `work_id_required`, and use the resolved work root. Give each fixer
a mission capsule with only the relevant contract/evidence paths. Fixers never
write PM-owned pointers or overview files.

## Workflow

### 1. Resolve and plan

#### Bind the push remote

Bind `REMOTE` before any publication helper. Use the caller-selected named
remote when supplied, then the current branch's configured push remote, then
`remote.pushDefault`. With none configured, accept only the sole remote whose
push URL resolves through GitHub. Every Git remote lookup uses `--` before the
name so a remote beginning with `-` remains data, not an option:

```bash
REMOTE=${CALLER_REMOTE:-}
CURRENT_BRANCH=$(git branch --show-current) || exit $?
if [ -z "$REMOTE" ] && [ -n "$CURRENT_BRANCH" ]; then
  REMOTE=$(git config --get -- "branch.$CURRENT_BRANCH.pushRemote") || REMOTE=
fi
if [ -z "$REMOTE" ]; then
  REMOTE=$(git config --get -- remote.pushDefault) || REMOTE=
fi
if [ -n "$REMOTE" ]; then
  git remote get-url --push -- "$REMOTE" >/dev/null || exit $?
else
  GITHUB_REMOTES=()
  while IFS= read -r CANDIDATE; do
    PUSH_URL=$(git remote get-url --push -- "$CANDIDATE") || exit $?
    if gh repo view "$PUSH_URL" --json nameWithOwner >/dev/null 2>&1; then
      GITHUB_REMOTES[${#GITHUB_REMOTES[@]}]=$CANDIDATE
    fi
  done < <(git remote || exit $?)
  [ "${#GITHUB_REMOTES[@]}" -eq 1 ] || {
    printf 'remote resolution requires one GitHub push remote; found %s\n' \
      "${#GITHUB_REMOTES[@]}" >&2
    exit 1
  }
  REMOTE=${GITHUB_REMOTES[0]}
fi
printf 'REMOTE=%s\n' "$REMOTE"
```

Record `REMOTE` in the publication plan. On zero or ambiguous GitHub candidates,
preserve the candidate evidence and stop rather than selecting one.

Inspect the selected tool's working state — `jj status`, `jj log`, and
`jj bookmark list`, or `git status --short`, `git log --oneline`, and
`git branch --list` — plus open PRs. Resolve `<commit-ref>` or the current
saved change and list changes, bookmarks, PR heads, and bases bottom-up.
Resolve each selected head to zero or one open PR: publish a missing head and
update an existing one in the same pass. This per-head choice makes retrying a
partially published stack idempotent. `ACTION=update` must initially resolve
its explicit PR/ref target to an open PR, but may include missing descendants
introduced by an accepted stack rewrite. If work must be saved, split, or
reordered, invoke `coding:commit`, then restart discovery. Reject an unknown
ref, nonlinear chain, merged-history rewrite, missing authentication, multiple
open PRs for one head, or remote ambiguity with evidence.

Always load [stacked-prs.md](stacked-prs.md) and enforce its mandatory archetype
splits. With no explicit shape, also calculate the size zone and suggest a stack
when an over-green surface has independent domain-coherent slices. A declined
optional suggestion or atomic change proceeds as one PR. With `--dry-run`,
print the exact plan and stop.

### 2. Verify exact local CI parity before publication

After stack discovery, resolve each selected head and its intended PR base to
exact Git SHAs. Encode them in `SELECTED_STACK_JSON` as objects with `head` and
`base` fields, ordered bottom-up; a standalone target has one object. Derive the
target from that map: the last selected head is the target SHA and the first
selected head's base is the target base. The tip's immediate PR base is not the
selected surface base.

```bash
SELECTED_HEAD_COUNT=$(jq -er 'length | select(. > 0)' <<<"$SELECTED_STACK_JSON")
TARGET_SHA=$(jq -er '.[-1].head | select(type == "string" and length > 0)' \
  <<<"$SELECTED_STACK_JSON")
TARGET_BASE=$(jq -er '.[0].base | select(type == "string" and length > 0)' \
  <<<"$SELECTED_STACK_JSON")
case "$SELECTED_HEAD_COUNT" in
  1)
    TARGET_KIND=standalone
    ;;
  *)
    test "$SELECTED_HEAD_COUNT" -gt 1 || exit 2
    TARGET_KIND=stack-tip
    ;;
esac
printf 'TARGET_KIND=%s\nTARGET_SHA=%s\nTARGET_BASE=%s\n' \
  "$TARGET_KIND" "$TARGET_SHA" "$TARGET_BASE"
```

Invoke the public parity action with those three bound inputs:

```text
coding:pr verify --target "$TARGET_SHA" --base "$TARGET_BASE" --kind "$TARGET_KIND"
```

Capture the action's complete `CI_PARITY_RECEIPT_JSON`, its canonical
`CI_PARITY_EXPECTED_WORKFLOW_COMMAND_RESULTS_JSON`, and its canonical
`CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON`. Consume them before every entry
or re-entry to publication:

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

A rewrite, base-map change, or command/result-set change invalidates the
receipt and restarts discovery before this step.

### 3. Publish bottom-up

Before every entry or re-entry to this phase, rerun the receipt gate above
against the current bound inputs. On the exception path, its `sha` equals the
exact `TARGET_SHA` and its `names` equal the verifier's exact lexically sorted
missing-secret names. A SHA-only approval or any name/order mismatch cannot
form a complete receipt and returns to step 2 before a remote mutation.

Require a saved, clean, linear chain to the selected `ROOT_BASE`/`DESTINATION`
at authoritative `$REMOTE`, standalone green changes, conventional descriptions per
[conventional-commits.md](../../commit/references/conventional-commits.md), no
selected change already merged at `$REMOTE`, and a derived or supplied branch prefix. If
needed, invoke `coding:commit --reorder`; for merged history follow
[workflow-correct-merged.md](../../commit/references/workflow-correct-merged.md).

Bottom-up, preserve a change's existing bookmark when the caller selected that
branch, it heads an open PR, or the stack already has explicit bookmarks:
include that exact head in publication. A bare `<branch-prefix>` head blocks its own `NN-`
children, so a stream growing into a stack renames it — local ref and forge
alike, since either blocks the child — before pushing the rest, per Essential's
naming contract. Only for an unbookmarked new change/stack: a lone change
takes `BOOKMARK=<branch-prefix>`,
a stack indexes `NN` from `01` to `99` into `BOOKMARK=<prefix>/NN-<scope>`,
kebab-case scope ≤30 characters; `<branch-prefix>` is `--branch-prefix`, else
the resolved stream's branch, else as derived; record the mode first.

If the immediate predecessor is selected, set `PR_BASE` to its bookmark and
`AUTHOR_BASE_OID` to its change/commit OID. Otherwise preserve an existing
PR's base; for a new PR resolve the immediate unmerged predecessor, using the
repository default branch only when none exists, then resolve that exact base
commit as `AUTHOR_BASE_OID`. New-stack bookmarks do not yet exist, so author
each head against `AUTHOR_BASE_OID`, never `PR_BASE`.

Select one archetype for each head using the
[classification table](#select-the-pr-archetype); this remains body and scanner
metadata only.

#### Discover and select repository labels

Before submitting each PR, bind label work to that PR's target repository and
host, then discover the complete live label inventory through the paginated
repository API before any push or PR create/edit. For an existing PR, retain its
absolute PR URL as `PR_URL` during per-head open-PR resolution and derive the
host, owner/repository, and issue number from that URL. For a new PR, resolve
the selected push remote's push URL through `gh repo view <push-url>` and use
its `parent` repository as the PR target when the remote is a fork; otherwise
the push repository is the target. Keep the push repository owner separately so
fork heads use `<owner>:<branch>` while `--repo` and all label/API calls remain
bound to the receiving repository. An unqualified current-directory lookup is
forbidden. The discovery command returns each label's exact `name` and API
`description`; use both to judge the closest suitable repository labels, then
pass the selected names together with their selected `{name, description}`
choices for refreshed validation and reconciliation.
Selection may include every suitable exact repository label, including the
closest available labels for PR type, risk, attention required, merge intent,
and PR structure. Zero labels is valid when none is suitable. Never create,
guess, or substitute a label, and never use a fixed vocabulary.

```bash
set -o pipefail
bind_pr_url_target() {
  local pr_url=$1 authority path owner repository_name pull_number
  case "$pr_url" in
    https://*/*/*/pull/*) ;;
    *) printf 'invalid PR URL: %s\n' "$pr_url" >&2; return 1 ;;
  esac
  authority=${pr_url#https://}
  REPOSITORY_HOST=${authority%%/*}
  path=${authority#*/}
  path=${path%%\?*}
  path=${path%%\#*}
  owner=${path%%/*}
  path=${path#*/}
  repository_name=${path%%/*}
  path=${path#*/}
  test "${path%%/*}" = pull || return 1
  pull_number=${path#*/}
  test "$pull_number" = "${pull_number%%/*}" || return 1
  case "$pull_number" in
    ''|*[!0-9]*) return 1 ;;
  esac
  test -n "$REPOSITORY_HOST" && test -n "$owner" && \
    test -n "$repository_name" || return 1
  REPOSITORY=$owner/$repository_name
  PR_NUMBER=$pull_number
}
if [ -n "${PR_URL:-}" ]; then
  PR=$PR_URL
  bind_pr_url_target "$PR_URL" || exit $?
else
  REMOTE_PUSH_URL=$(git remote get-url --push -- "$REMOTE") || exit $?
  PUSH_REPOSITORY_JSON=$(gh repo view "$REMOTE_PUSH_URL" \
    --json nameWithOwner,url,parent) || exit $?
  PUSH_REPOSITORY=$(jq -er '.nameWithOwner' <<<"$PUSH_REPOSITORY_JSON") || exit $?
  PUSH_REPOSITORY_URL=$(jq -er '.url' <<<"$PUSH_REPOSITORY_JSON") || exit $?
  case "$PUSH_REPOSITORY_URL" in
    https://*/*/*) ;;
    *) printf 'invalid push repository URL: %s\n' "$PUSH_REPOSITORY_URL" >&2; exit 1 ;;
  esac
  PUSH_OWNER=${PUSH_REPOSITORY%%/*}
  REPOSITORY_HOST=${PUSH_REPOSITORY_URL#https://}
  REPOSITORY_HOST=${REPOSITORY_HOST%%/*}
  REPOSITORY=$PUSH_REPOSITORY
  PR_HEAD=$BOOKMARK
  if jq -e '.parent != null' <<<"$PUSH_REPOSITORY_JSON" >/dev/null; then
    REPOSITORY=$(jq -er '
      .parent
      | select(
          (.owner.login | type == "string" and length > 0) and
          (.name | type == "string" and length > 0)
        )
      | .owner.login + "/" + .name
    ' <<<"$PUSH_REPOSITORY_JSON") || exit $?
    PUSH_OWNER_TYPE=$(gh api --hostname "$REPOSITORY_HOST" \
      "users/$PUSH_OWNER" | jq -er '.type') || exit $?
    if [ "$PUSH_OWNER_TYPE" != User ]; then
      printf 'organization-owned fork heads are unsupported by gh pr create: %s\n' \
        "$PUSH_OWNER" >&2
      exit 1
    fi
    PR_HEAD=$PUSH_OWNER:$BOOKMARK
  fi
  test -n "$REPOSITORY_HOST" || exit 1
fi
discover_repository_labels() {
  gh api --hostname "$REPOSITORY_HOST" --paginate --slurp \
    "repos/$REPOSITORY/labels?per_page=100" |
    jq -ce '[.[][] | {name, description}]'
}
attached_issue_labels() {
  local pr_number=$1
  gh api --hostname "$REPOSITORY_HOST" --paginate --slurp \
    "repos/$REPOSITORY/issues/$pr_number/labels?per_page=100" |
    jq -ce '[.[][] | .name]'
}
repository_label_names() {
  jq -ce '[.[].name]' <<<"$1"
}
validate_selected_labels() {
  local available=$1 unavailable description_drift
  unavailable=$(jq -cn --argjson selected "$SELECTED_LABELS" \
    --argjson available "$available" \
    '$selected - [$available[] | .name] | unique') || return $?
  if ! jq -e 'length == 0' <<<"$unavailable" >/dev/null; then
    printf 'selected labels unavailable in repository: %s\n' \
      "$unavailable" >&2
    return 1
  fi
  description_drift=$(jq -cn \
    --argjson choices "$SELECTED_LABEL_CHOICES" \
    --argjson available "$available" '
      [
        $choices[] as $choice
        | $available[]
        | select(.name == $choice.name and .description != $choice.description)
        | {
            name: $choice.name,
            selected_description: $choice.description,
            current_description: .description
          }
      ] | unique_by(.name)
    ') || return $?
  if ! jq -e 'length == 0' <<<"$description_drift" >/dev/null; then
    printf 'selected label descriptions changed in repository: %s\n' \
      "$description_drift" >&2
    return 1
  fi
}
preflight_label_mutation_permission() {
  local permissions
  if [ -z "${PR_URL:-}" ] && \
    jq -e 'length == 0' <<<"$SELECTED_LABELS" >/dev/null; then
    return 0
  fi
  permissions=$(gh api --hostname "$REPOSITORY_HOST" \
    "repos/$REPOSITORY" | jq -ce '.permissions') || return $?
  if jq -e '
    (.admin == true) or (.maintain == true) or (.push == true) or
    (.triage == true)
  ' <<<"$permissions" >/dev/null; then
    return 0
  fi
  if jq -e 'length > 0' <<<"$SELECTED_LABELS" >/dev/null; then
    printf 'selected labels require repository label permission\n' >&2
  else
    printf 'repository-only label reconciliation requires repository label permission\n' \
      >&2
  fi
  return 1
}
reconcile_pr_labels() {
  local pr_number=$1 attached=$2 available=$3 removals additions
  local label_json encoded_label delete_error
  removals=$(jq -cn --argjson attached "$attached" \
    --argjson available "$available" \
    '$attached - $available | unique') || return $?
  additions=$(jq -cn --argjson selected "$SELECTED_LABELS" \
    --argjson attached "$attached" \
    '$selected - $attached | unique') || return $?
  while IFS= read -r label_json; do
    encoded_label=$(jq -er '@uri' <<<"$label_json") || return $?
    if ! delete_error=$(gh api --method DELETE --hostname "$REPOSITORY_HOST" \
      "repos/$REPOSITORY/issues/$pr_number/labels/$encoded_label" \
      2>&1 >/dev/null); then
      case "$delete_error" in
        *404*) ;;
        *) printf '%s\n' "$delete_error" >&2; return 1 ;;
      esac
    fi
  done < <(jq -c '.[]' <<<"$removals")
  while IFS= read -r label_json; do
    jq -cn --argjson label "$label_json" '{labels: [$label]}' |
      gh api --method POST --hostname "$REPOSITORY_HOST" \
        "repos/$REPOSITORY/issues/$pr_number/labels" --input - \
        >/dev/null || return $?
  done < <(jq -c '.[]' <<<"$additions")
}
REPOSITORY_LABELS=$(discover_repository_labels) || exit $?
SELECTED_LABELS=${SELECTED_LABELS:-'[]'}
SELECTED_LABEL_CHOICES=${SELECTED_LABEL_CHOICES:-'[]'}
jq -e 'type == "array" and all(.[]; type == "string")' \
  <<<"$SELECTED_LABELS" >/dev/null || exit $?
jq -e '
  type == "array" and all(
    .[];
    type == "object" and
    (.name | type == "string") and
    has("description") and
    ((.description == null) or (.description | type == "string"))
  )
' <<<"$SELECTED_LABEL_CHOICES" >/dev/null || exit $?
jq -ne --argjson selected "$SELECTED_LABELS" \
  --argjson choices "$SELECTED_LABEL_CHOICES" \
  '$selected | unique | sort == ([$choices[] | .name] | unique | sort)' \
  >/dev/null || exit $?
validate_selected_labels "$REPOSITORY_LABELS" || exit $?
preflight_label_mutation_permission || exit $?
```

Validation is deliberately fail-closed even though selection uses live
repository data: caller-provided selection may already be stale, and the
repository inventory may change between discovery and publication. Rejection
preserves the repository-only invariant by stopping instead of substituting a
different label. A fork target is reconstructed from the actual nested
`parent.owner.login` and `parent.name` fields while retaining the push
repository's host. Reject an organization-owned fork before the batch push
because `gh pr create --head OWNER:BRANCH` supports only user-owned forks.
Preflight repository label permission before publication whenever selected
labels or an existing PR can require reconciliation; a new PR with no selected
labels needs no label mutation permission. Split each exact `title\n\nbody` into that head's `TITLE` and `BODY`;
malformed output aborts the whole selection before any ref or remote mutation.

After every per-head `PR_BASE` is resolved, bind the batch root to the first
selected affected head's exact base:

```bash
ROOT_BASE=$PR_BASE_01
printf 'ROOT_BASE=%s\n' "$ROOT_BASE"
```

For a suffix restack, `PR_BASE_01` is the unselected predecessor, not the
repository destination. Record `ROOT_BASE` with the selected head/base map and
keep it unchanged for a retry only while that selection and map remain
unchanged. Any discovery restart or base-map change recomputes it before the
next helper call.

On the jj path, all history edits and existing-bookmark movement belong to
`coding:commit`; rely on jj's automatic descendant rebase and bookmark movement.
Only during initial publication, establish the identity of an unbookmarked
change before the batch push:

```bash
jj bookmark create "$BOOKMARK" --revision "$CHANGE_ID"
```

Never run that command for an update or to move an existing bookmark. Collect
every affected unmerged bookmark and its exact expected local Git SHA for the
single batch publication below.

On the git path, prepare the local branch; the helper owns its only push:

```bash
git branch --force "$BOOKMARK" "$CHANGE_ID"
```

The helper's Git push is leased, never bare `--force`. Its jj batch push checks
each bookmark against its last-seen remote state, giving force-with-lease-like
protection against overwriting a remote advance.

Before creating or editing PRs, publish the complete affected selection through
the helper in one call:

```bash
bash "${CODING_PR_SKILL_DIR}/scripts/restack.sh" \
  --remote "$REMOTE" \
  --base "$ROOT_BASE" \
  "$BOOKMARK_01=$EXPECTED_HEAD_OID_01" \
  "$BOOKMARK_02=$EXPECTED_HEAD_OID_02"
```

On jj this produces one `jj git push --remote "$REMOTE"` with repeated explicit
`--bookmark` selectors for all and only affected unmerged heads; it never uses
`--all`. On plain Git the helper retains per-branch `--force-with-lease`
publication. Do not follow a jj batch with gh-stack rebase, sync, push, or
submit. Preserve stderr and the helper's `restacked` and `errors` arrays so a
failure reports verified partial state rather than implying an all-or-nothing
result.
When the head has no open PR, create the draft against the resolved
`HOST/OWNER/REPOSITORY` target without label flags, using the fork-qualified
head when the push repository differs. Require the returned absolute PR URL to
match the receiving target. Capture all
attached labels through the paginated issue-label endpoint, refresh the
repository inventory, then reconcile from that snapshot:

```bash
PR=$(gh pr create --repo "$REPOSITORY_HOST/$REPOSITORY" \
  --draft --title "$TITLE" --body-file - \
  --base "$PR_BASE" --head "$PR_HEAD" <<<"$BODY")
PR_URL=$PR
EXPECTED_REPOSITORY=$REPOSITORY
EXPECTED_REPOSITORY_HOST=$REPOSITORY_HOST
bind_pr_url_target "$PR" || exit $?
test "$REPOSITORY" = "$EXPECTED_REPOSITORY" && \
  test "$REPOSITORY_HOST" = "$EXPECTED_REPOSITORY_HOST" || exit 1
CREATED_LABELS=$(attached_issue_labels "$PR_NUMBER") || exit $?
REFRESHED_REPOSITORY_LABELS=$(discover_repository_labels) || exit $?
REFRESHED_REPOSITORY_LABEL_NAMES=$(repository_label_names \
  "$REFRESHED_REPOSITORY_LABELS") || exit $?
validate_selected_labels "$REFRESHED_REPOSITORY_LABELS" || exit $?
reconcile_pr_labels "$PR_NUMBER" "$CREATED_LABELS" \
  "$REFRESHED_REPOSITORY_LABEL_NAMES" || exit $?
```

When the head has one open PR, edit it and retain draft state. Refresh the
repository labels, then reconcile the PR against that source of truth. Capture
attached labels through the paginated issue-label endpoint. Remove only names
that were both in that snapshot and absent from the refreshed repository list;
URL-encode each exact name in its DELETE path. Add each selected missing label
with one JSON POST. Exact add/remove operations preserve concurrent valid label
additions and avoid every mutation when both differences are empty. Do not use
full-set PUT reconciliation or comma-separated `gh pr edit --add-label` /
`--remove-label` arguments:

```bash
gh pr edit "$PR" --title "$TITLE" --body-file - --base "$PR_BASE" <<<"$BODY"
CURRENT_LABELS=$(attached_issue_labels "$PR_NUMBER") || exit $?
REFRESHED_REPOSITORY_LABELS=$(discover_repository_labels) || exit $?
REFRESHED_REPOSITORY_LABEL_NAMES=$(repository_label_names \
  "$REFRESHED_REPOSITORY_LABELS") || exit $?
validate_selected_labels "$REFRESHED_REPOSITORY_LABELS" || exit $?
reconcile_pr_labels "$PR_NUMBER" "$CURRENT_LABELS" \
  "$REFRESHED_REPOSITORY_LABEL_NAMES" || exit $?
gh pr ready "$PR" --undo # skip only when already draft
```

After either create or update, refresh the available repository names and prove
that every selected label is attached and every attached label is currently
repository-available. Evaluate both conditions independently and exit nonzero
if either check fails:

```bash
POST_REPOSITORY_LABELS=$(discover_repository_labels) || exit $?
validate_selected_labels "$POST_REPOSITORY_LABELS" || exit $?
POST_REPOSITORY_LABEL_NAMES=$(repository_label_names \
  "$POST_REPOSITORY_LABELS") || exit $?
ATTACHED_LABELS=$(attached_issue_labels "$PR_NUMBER") || exit $?
MISSING_SELECTED_LABELS=$(jq -cn --argjson selected "$SELECTED_LABELS" \
  --argjson attached "$ATTACHED_LABELS" '$selected - $attached')
UNAVAILABLE_ATTACHED_LABELS=$(jq -cn --argjson attached "$ATTACHED_LABELS" \
  --argjson available "$POST_REPOSITORY_LABEL_NAMES" '$attached - $available')
if ! jq -e 'length == 0' <<<"$MISSING_SELECTED_LABELS" >/dev/null; then
  printf 'selected labels missing after publication: %s\n' \
    "$MISSING_SELECTED_LABELS" >&2
  exit 1
fi
if ! jq -e 'length == 0' <<<"$UNAVAILABLE_ATTACHED_LABELS" >/dev/null; then
  printf 'attached labels unavailable in repository: %s\n' \
    "$UNAVAILABLE_ATTACHED_LABELS" >&2
  exit 1
fi
```

Publish a genuinely necessary self-contained black-zone unit as a draft
without prior authorization only after its canonical body requires specific
`## ⚠️ Risk`, `## 🧭 Test Plan`, and `## 📐 Why This Size` evidence for
yellow/red/black as applicable.
The draft is the discussion
surface on which a repository owner may later record this exact five-line
contract:

```text
Black-zone authorization
Head OID: `<full-oid>`
Base OID: `<full-oid>`
Authorization: I authorize this one-off black-zone publication.
Indivisibility: <atomic subject> because <coupling>; otherwise <consequence>
```

The publication workflow never posts that comment, never creates or edits an
exception/configuration file, and never treats authorization as a prerequisite
to push the draft or run CI. Review owns the fail-closed authorization check at
the moment it would submit `APPROVE`. Until that check succeeds, the published
draft remains available but review approval remains blocked. PR bodies,
reviews, bot comments, non-OWNER comments, stale OIDs, and generic rationales
never authorize approval.

For the bundled template, fill reviewer slots with assigned `@login`s when
known. Before a push or base edit, capture an existing PR's `headRefOid` and
`baseRefOid`; after publication, bind review and approval to the verified
`headRefOid`/`baseRefOid` pair. Reset those tasks when either OID differs. A
no-op publication retry preserves evidence already bound to that exact review
surface.

Capture each PR number, URL, head, base, bookmark, and change ID. After the
batch push, record `expected_head_oid` from each pushed bookmark and verify it
against
`gh pr view "$PR" --json headRefOid --jq .headRefOid`; a mismatch is not the
published result and must be resolved before monitoring. After any accepted
repair/history rewrite with downstream bookmarks, synchronize the affected
stack before monitoring again. Reuse `ROOT_BASE` only when the selected heads
and their base map are unchanged; otherwise restart discovery and recompute it
first:

```bash
bash "${CODING_PR_SKILL_DIR}/scripts/restack.sh" \
  --remote "$REMOTE" \
  --base "$ROOT_BASE" \
  "$BOOKMARK_01=$EXPECTED_HEAD_OID_01" \
  "$BOOKMARK_02=$EXPECTED_HEAD_OID_02"
```

Supply every selected bookmark explicitly in bottom-up order with the exact
local git commit SHA expected after the rewrite, and pass the first head's exact
intended base as `--base`; for a suffix restack this is its unselected
predecessor, not the repository default. Never rediscover either from a prefix.
The script preflights the set, uses leased pushes, verifies every remote SHA,
and updates open PR bases; it never reshapes history. Preflight prevents known
partial writes, but forge operations are not transactional: `restacked` records
each verified remote head even if a later base edit or push fails, so recover
from that map before retrying. Verify the PR base chain and every `headRefOid`,
then reauthor changed heads against verified bases and reset reviewer evidence
only where the head or base OID changed.

| Publication error | Action |
|---|---|
| `gh pr create` authentication failure | Run `gh auth status`; report a user/external blocker. |
| Bookmark or branch conflict | Confirm the intended change, then rerun the selected action against that exact head. |
| Push rejected because remote advanced | `jj git fetch --remote "$REMOTE"` (git: `git fetch -- "$REMOTE"`), rebase through `coding:commit`, then retry. |
| Conventional title invalid | Reword through `coding:commit`, then restart that iteration. |
| Existing PR has wrong base | `gh pr edit "$PR" --base "$PR_BASE"`, then verify. |
| Restack conflict | Resolve through `coding:commit`, run integrity checks, then republish bottom-up. |

With `--publish-only`, return the verified stack map plus refreshed expected
hosted checks and their workflow/ruleset/config inputs. Do not enter review or
hosted-CI convergence; the invoking review or red-CI workflow owns the next step.

### 4. Converge review comments unless skipped

After every selected head is pushed or updated and its remote OID is verified,
load and follow [review-loop.md](review-loop.md), unless `--no-review` is
present. A review-driven fix republishes the affected stack, resets the expected
head OIDs, and runs the loop again with a fresh subagent before CI monitoring.
If the loop returns `action: repair_ci_then_review`, enter step 5 immediately
without marking review convergence complete or incrementing its retry count.
After the poller reports a red repair, the parent accepts the fix, saves it,
and republishes through the owned workflow; if CI instead becomes green, no
repair is needed. Then return to step 4 and run a fresh review pass before
completing the ordinary CI gate. Never retry a review against unchanged red-CI
evidence.

If the loop returns `action: await_owner_authorization`, record the approval
blocker and its complete `authorization_required` list, including each PR URL
and exact head/base OIDs, then enter step 5 without marking review convergence
complete or retrying the review. After CI is green, report the published drafts
with that list under `approval_blocked: authorization_required`. A later
invocation reruns review against every then-current head and base; review alone
verifies each authorization at the moment it would submit `APPROVE`.

### 5. Schedule and consume the initial poll

Immediately after every initial publication, run this command with actual
bottom-to-top PR URLs substituted:

```text
/loop 5m Dispatch ONE small read-oriented polling subagent for <stack PR URLs> in bottom-up order. Pass it the stack and discovered expected hosted checks, and require it to load and follow the Poll contract in coding:pr references/create-update.md; only when it classifies a red check, require it to load references/repair-red-ci.md. Consume its bounded <report>, then take the parent action it requests. The scheduled parent MUST NOT run gh polling itself.
```

Capture the returned task/job ID as `active_loop_id`. Cancel only that exact ID
with `CronDelete(active_loop_id)` or the scheduler's natural cancellation keyed
by the same ID; never cancel by cadence or description.

#### Poll contract

The one poller queries every PR bottom-up, without `--required` or filtering:

```bash
gh pr checks <pr> --json bucket,completedAt,link,name,startedAt,state,workflow
```

Before consuming checks, query the current PR `headRefOid` and require it to
equal the parent's recorded `expected_head_oid`. Treat a mismatch as pending
with explicit stale-head evidence; never accept checks from an older or
unexpected revision.

It is read-oriented: it may inspect with `gh` and, only through the red
reference, dispatch exactly one scoped fixer; it MUST NOT edit, commit, rebase,
restack, or push. It returns under 1000 tokens:

<report>

```yaml
stack:
  - pr: <number-or-url>
    head: <bookmark>
    head_oid: <current remote PR head SHA>
    expected_head_oid: <SHA recorded immediately after the latest push>
    base: <base branch>
    config_ref: <workflow/ruleset ref confirmed for this head/base>
    state: green | pending | red
    expected_checks:
      - name: <workflow job or required status name>
        source: <workflow path/job, branch protection, or ruleset>
    inaccessible_expected_sources: [<source and access error>]
    observed_checks:
      - name: <name>
        workflow: <workflow>
        bucket: <bucket>
        state: <state>
        link: <url>
        started_at: <timestamp>
        completed_at: <timestamp or null>
        wall_time_seconds: <completedAt-startedAt or null>
schedule:
  task_id: <active_loop_id>
  action: keep | cancel | replace
red_repair: <report from repair-red-ci.md or null>
blocker: <configuration/provider blocker or null>
unresolved: [<remaining blocker>]
action: notify_and_cancel | wait | parent_repair | blocked
```

</report>

Classify every returned check from both `bucket` and `state`, with precedence
red, pending, green:

- **Red**: any check has a fail/cancel bucket or failure, cancelled, or
  timed-out state. Cancel `active_loop_id`, process the earliest red PR, and
  load [repair-red-ci.md](repair-red-ci.md). The poller follows that
  conditional reference before returning its report.
- **Pending**: none are red and any check is pending, queued, expected, waiting,
  in progress, lacks `completedAt`, belongs to a mismatched head SHA, or is an
  expected check not yet observed. Match matrix jobs using the documented
  stable job-name prefix captured during discovery; otherwise require an exact
  name match. Zero observed with a confirmed nonempty expected list is pending.
  Keep `active_loop_id`, make no edits, dispatch no fixer, and return
  `action: wait` for the next wake.
- **Green**: every observed check is pass/success, skipping/skipped, or an
  explicitly accepted neutral result, every expected check has a matched
  terminal accepted observation for `expected_head_oid`, and no observed check
  is red or pending. Zero observed is green only after refreshing the remote PR
  head, confirming current workflow/base required-status/ruleset configuration,
  and proving the expected list empty; retain expected/observed evidence. When
  every PR is green, cancel `active_loop_id`, notify, and stop.

For zero observed checks with inaccessible/unconfirmed expected sources, keep
the PR pending, cancel the loop, and return top-level `action: blocked` with
head/config/source/access evidence. Never use an arbitrary timeout to infer a
state.

Scheduled tasks fire only while the session is open and idle. Unexpired tasks
restore on `--resume` or `--continue`; expired tasks are not replayed.

### Author the PR text

Compose deterministic `title\n\nbody` for a commit and optional base. Step 3
passes its base; text-only callers default to the first parent. Never invoke `gh`.

1. Resolve the commit ref, defaulting to `@` after the functional jj check and
   to `HEAD` otherwise. Resolve an optional base, defaulting to the first
   parent or, for a root commit, the empty tree from
   `git hash-object -t tree /dev/null`. Try
   `jj log -r <ref> --no-graph -T 'description'`, then
   `git log -1 --format=%B <ref>`. Unknown refs exit 2; neither tool exits 3.
   Record the resolved head/base OIDs for step 4.
2. Extract the subject (first non-empty line) and body (everything after the
   first blank line). Recognize commit trailers (`Refs:`, `Closes:`,
   `Fixes:`, `BREAKING CHANGE:`, `Testing:`, `Manual-Test:`) for routing in
   step 5.
3. Validate the subject against the Conventional Commits regex — the
   canonical conventional-commits.org type allowlist with optional `(scope)`
   and `!` for breaking changes:

   ```
   ^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([\w./-]+\))?!?: .+
   ```

   On mismatch, exit 2 with the failing token, the regex, and the offending
   subject. This skill is the single source of truth for the regex; it is
   mirrored in `coding:commit`
   (`../../commit/references/conventional-commits.md`).
4. For every non-root commit, resolve the review surface from the merge base:
   use `jj log --no-graph -T 'commit_id' -r
   "heads(::<head-oid> & ::<base-oid>)"` on the jj path or
   `git merge-base <base-oid> <head-oid>` on the git path. Use the empty tree
   only for the root-commit fallback. Calculate the active size zone from that
   exact surface under `GIT-PR-SIZE-*`. Run the classifier only after binding
   the exact base and head OIDs; it derives the zone for this authoring step and
   is not a policy authority:

   ```bash
   SIZE_JSON=$(uv run --python 3.13 \
     "${CODING_PR_SKILL_DIR}/scripts/classify-pr-size.py" \
     --repo "$REPO_ROOT" --base "$BASE_OID" --head "$HEAD_OID")
   ```

   Read `zone`, `files_changed`, `net_loc`, and `required_reviewers` from
   `SIZE_JSON`. The classifier's
   file count includes every changed path and excludes generated-file
   additions and deletions only from authored net LOC. The canonical thresholds
   are fixed. Record the required sections for that zone. A black-zone change
   remains black and requires specific `## ⚠️ Risk`, `## 🧭 Test Plan`, and
   `## 📐 Why This Size` evidence. Author them for the exact draft head/base pair
   that may carry later OWNER discussion
   authorization. The draft may be pushed and tested without prior
   authorization; review verifies authorization only before submitting
   `APPROVE`.
5. Resolve the template — first hit wins, paths relative to the repo root:

   1. `.github/PULL_REQUEST_TEMPLATE.md`
   2. `.github/pull_request_template.md`
   3. `docs/PULL_REQUEST_TEMPLATE.md`
   4. `docs/pull_request_template.md`
   5. `PULL_REQUEST_TEMPLATE.md`
   6. `pull_request_template.md`

   <IMPORTANT>A repo-local template is emitted verbatim — never fill
   placeholders in or otherwise mutate a foreign template; skip placeholder
   filling in step 6.</IMPORTANT> Before emission, apply step 6's evidence
   predicates to the content—every predicate, including always-required, zone-required,
   archetype-required, and diff-required. Stop when a required section is
   missing, empty, placeholder-only, generic, or lacks its named evidence.
   This validation never inserts category, label, title, or body metadata.
   In particular:
   - every body contains a non-empty Summary, `## 🎯 Goal`,
     `## ✅ Requirements`, `## 🧵 Context`, and `## 🧪 Verification`; Goal
     states the intended outcome, while Requirements lists observable,
     testable behavior rather than generic gates such as tests passing,
     standards compliance, or green CI;
   - every `##` section heading starts with an emoji, and every section the
     template permits authors to omit ends with the exact `[ Optional ]`
     suffix; the suffix describes template conditionality and does not waive a
     zone, archetype, or diff requirement;
   - a red- or black-zone `## 📐 Why This Size` contains specific indivisibility prose,
     and a black-zone body also contains specific Risk and Test plan evidence;
   - a `migration`, `feature-flag`, or `ui` PR supplies the corresponding
     Rollback, Feature Flag, or Screenshots evidence from step 6; and
   - whenever the review diff contains generated files, the body contains the
     exact `## 🏭 Generated Files` heading with at least one generated path or
     path pattern and its source or generator. A heading alone, `N/A`,
     "generated files present", or another path-free summary is generic and
     blocks emission.

   A heading's presence alone never passes. When no repo-local template exists,
   fall back to the bundled default at
   [message.md](../templates/message.md) and continue.
   When the bundled default is also missing: exit 4, print the path that
   failed to resolve.
6. Fill the bundled default's placeholders from the commit body, diff, and
   recorded verification evidence. Before matching a Markdown section name,
   strip its leading emoji token and trailing `[ Optional ]` suffix so the
   canonical template headings and their plain aliases resolve identically:
   - `{{summary_paragraph}}` — first body paragraph (≤3 sentences); fall back
     to the subject text after `: ` when the body is empty.
   - `{{goal_body}}` — exact content under `## Goal` / `Goal:` / `Intent:` /
     `Purpose:`; otherwise the first body paragraph, then the subject text after
     `: `. It states the outcome and why it matters, not the implementation.
   - `{{requirements_body}}` — bullets under `## Requirements` /
     `Requirements:` / `Acceptance Criteria:` / `Behavior:`. Each item names
     observable, testable behavior. Stop when none exist or when every item is
     a generic process gate such as passing tests, following standards, or
     keeping CI green; never infer requirements from implementation details.
   - `{{context_body}}` — content under `## Context` / `Why:` /
     `Background:`. Stop when absent rather than duplicating Summary or
     inventing background from the diff.
   - `{{implementation_body}}` — content under `## Implementation` / `What:`
     / `How:`, if present.
   - `{{breaking_changes_body}}` — `BREAKING CHANGE:` footers; "None." when
     absent.
   - `{{rollback_body}}` — exact rollback steps or explicit forward-only
     mitigation. Required for the `migration` archetype.
   - `{{feature_flag_body}}` — flag name, default state, removal target,
     rollout plan, and cleanup change. Required for the `feature-flag`
     archetype.
   - `{{screenshots_body}}` — before/after screenshots and relevant
     accessibility notes. Required for the `ui` archetype.
   - `{{generated_files_body}}` — every generated path and its source or
     generator. Required whenever the diff contains generated files, even when
     platform metadata marks them as generated.
   - `{{risk_body}}` — exact content under `## Risk` / `Risk:`. Required for
     yellow/red/black; stop when absent rather than inventing it from the diff.
   - `{{test_plan_body}}` — exact content under `## Test plan` /
     `Test-Plan:`. Required for yellow/red/black; stop when absent.
   - `{{why_this_size_body}}` — exact content under `## Why this size`.
     Required for red and black. Require specific
     prose explaining why the surface is indivisible; stop when it is absent
     or generic. Do not render size counts, zone metadata, or reviewer-time
     estimates.
   - `{{related_issues_body}}` — `Refs:` / `Closes:` / `Fixes:` trailers;
     "None." when absent.
   - `{{verification_body}}` — `Testing:` / `Manual-Test:` trailers, rendered
     as a checklist of the checks that must pass before sign-off, specific to
     this change and ticked as each one is confirmed. Every item is a check;
     an observation, a result, or evidence of what already happened belongs in
     Implementation. Change-specific checks are mandatory; standard items never
     replace them. Append one assigned/reviewed/approved reviewer triplet per
     `required_reviewers`, in slot order, using the exact head/base OIDs recorded
     in step 4 and the template's Verification shape.
   - `{{boundary_body}}` — bullets naming related work the instruction placed
     outside this change, so its edges are not read as gaps. It records the
     scope it was given, not the author's own judgment calls. "None." when
     absent.
   - `{{additional_notes_body}}` — remaining unmapped body content; "None."
     when absent.

   Drop an optional section that resolves to "None." rather than leaving a
   stub. Never publish a generic or missing always-, zone-, archetype-, or
   diff-required section; stop and report the missing evidence when it cannot
   be derived specifically. Strip every author-facing guidance comment and
   `[ Optional ]` heading marker from the rendered body; keep Summary, Goal,
   Requirements, Context, and Verification always.
7. After rendering and before emission or publication, scan the body against
   its selected template and active standard conditions. Build repeated
   `--generated-file` arguments from every generated path in `SIZE_JSON`, then
   run:

   ```bash
   if ! MESSAGE_SCAN=$(uv run --python 3.13 \
     "${CODING_PR_SKILL_DIR}/scripts/scan-pr-message.py" \
     --body-file - --template "$TEMPLATE" --zone "$ZONE" \
     --archetype "$ARCHETYPE" --head-oid "$HEAD_OID" \
     --base-oid "$BASE_OID" --allow-pending-reviewers \
     "${GENERATED_ARGS[@]}" <<<"$BODY"); then
     printf '%s\n' "$MESSAGE_SCAN" >&2
     exit 5
   fi
   ```

   Exit 5 with the scanner's JSON when it reports a violation. Do not publish
   or reinterpret the failure as advice; fix the owning standard rule and
   rerender. The scanner establishes structural conformance while semantic
   review establishes whether the evidence is specific and true. The
   authoring-only pending flag permits unchecked reviewer tasks before anyone
   can review; the review workflow omits it and requires confirmed triplets.
8. Emit the title line, a single blank line, then the Markdown body to stdout.
   Exit codes: `0` success, `2` unknown ref or non-conventional subject, `3` no
   commit source available, `4` bundled default template missing, `5` rendered
   message violates `coding:standards/git/`.

## Verification and Completion

- The title matches the Conventional Commits regex and the rendered body passes
  [scan-pr-message.py](../scripts/scan-pr-message.py). Every emitted body has
  behavioral Goal and Requirements sections and emoji-prefixed headings with
  no `[ Optional ]` authoring markers; a repo template is verbatim, or the
  bundled default has no placeholder or dropped-section stub. The same
  head OID, base/empty-tree OID, template, thresholds, and placeholder map yield
  byte-identical `title\n\nbody` without timestamps or random IDs.
- The applicable `pull_request` test and lint commands passed locally at the
  exact standalone head or selected stack-tip SHA, with their revision-bound
  sources and results recorded. The sole exception records the user's explicit
  approval to push that same SHA without the local run for the verifier's exact
  lexically sorted missing-secret names.
- Every head was pushed under a lease — one explicit affected-bookmark
  `jj git push` on the jj path,
  `git push --force-with-lease` on the git path; every PR is draft, uses the
  authored title/body, and has the intended stack base.
- Review convergence passed on each final head with no unresolved P0/P1/P2
  finding or mandatory chore, including replies and repair heads, or
  `--no-review` was explicitly recorded.
- Self-contained black-zone drafts may be reported as published and green while
  carrying `approval_blocked: authorization_required` plus the complete list
  of blocked PR URLs and exact head/base OIDs. This is not review convergence
  or merge readiness. Only the review workflow may clear each blocker, by
  verifying a current OWNER comment immediately before it submits `APPROVE`.
- Report success only after the final poll observes every PR green. Include the
  stack map, resolved commit refs, the template used per change (repo path or
  bundled default), local results, review passes, replies, repair commits,
  push/restack actions, per-PR check states, CI wall times, and any blocker
  (with its authoring exit code where relevant). Return every local project path
  created or materially rewritten during repair as `generated_files`. The PM
  applies the shared size pass only to eligible `.state` work Markdown.
