# Create or Update Pull Requests

Load the complete workflow from `coding:pr create` or `coding:pr update`;
`coding:pr author` loads only [Author the PR text](#author-the-pr-text). Turn
one saved change or stack into live, green draft PRs. This workflow composes
deterministic Conventional Commits PR text, publishes bottom-up, and owns hosted
CI until green or blocked. Repair obeys the **Coherence Mandate**: produce one
continuous work; rewrite over restructure, restructure over integrate, never
append. Dissolve new content into the existing structure. Visible seams,
parallel paths, addenda, vestigial helpers, and tack-ons are forbidden.

Reviewers own size-rule findings and reviewability judgments. This workflow
owns deterministic zone calculation and the authoring gates below.

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
- `--skip-local-test` skips only local command execution. It never skips CI
  discovery, publication, hosted monitoring, evidence, repair, or convergence.
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
| `--skip-local-test` | Skip only the local tester dispatch and commands. |
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

## Engineering-work gate

Before creating or materially rewriting a project artifact, read the absolute
`engineering-work.md` path injected by Essential. If unavailable, stop artifact
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

### 2. Discover local CI parity and run it unless skipped

Resolve the target repository's main source checkout first:

```bash
SOURCE_REPO_ROOT=$(git rev-parse --show-toplevel)
```

Use that main checkout for read-only discovery of local environment sources and
command-level references. Inspect `.github/workflows/*`, `package.json`,
workspace manifests, Makefiles, and task files there, plus `.env`, `.env.local`,
and `.env.test` when present. These local files may be ignored and therefore
absent from a disposable worktree. Do not execute repository commands from the
main checkout or copy secret values into a report.

For each selected head bottom-up, create a detached disposable worktree at its
exact SHA through the bundled helper and bind its distinct JSON result:

```bash
TREE_JSON=$(bash "${CODING_PR_SKILL_DIR}/scripts/temp-tree.sh" \
  open-git "$SOURCE_REPO_ROOT" "$TARGET_SHA")
TREE_LEASE=$(jq -er .lease <<<"$TREE_JSON")
TEST_WORKTREE=$(jq -er .tree <<<"$TREE_JSON")
test "$(git -C "$TEST_WORKTREE" rev-parse HEAD)" = "$TARGET_SHA"
```

Repeat the binding with per-head variables and retain every returned lease/tree
pair. The context-owning parent passes only the selected `TEST_WORKTREE` paths
to testers; it never transfers cleanup ownership. Before dispatch, a
cancellation, skipped run, or blocked discovery closes every lease. After
dispatch begins, the parent closes only a completed batch's leases and retains
undispatched batches. It verifies each closed lease and registration are gone.

Read the workflow and script definitions from each returned `tree` to confirm
the exact commands at that SHA, and inspect workflow `env`, `secrets.*`,
`vars.*`, and command-level environment references for revision drift. List
the compile, type, lint, test, and build commands that reproduce CI without
hosted services. Record variable names and source presence only; never copy
secret values into a report. For every required variable, verify that the
isolated tester can receive it from a user-approved source in the main checkout
or another explicitly approved location; an env file need not be copied.
Record hosted-only checks and unavailable services or credentials. If a
required variable is missing without `--skip-local-test`, ask for its intended
source; if unavailable, ask whether to skip local tests and publish. With the
flag, record the hosted-only gap and run no local commands. Never guess a
secret source or silently use an empty value.
For each selected change, record expected hosted PR check/job names from
`pull_request`-triggered jobs at that ref and required branch status
checks/rulesets when accessible through `gh api`; record inaccessible sources
instead of assuming they are empty.

Unless `--skip-local-test` is present, partition the ordered heads into
sequential bottom-up batches of at most ten. Dispatch one fresh small-model
read-only tester per batch; never reuse its context for another batch. It MUST
NOT edit, format, commit, or push. For its batch it runs every runnable command
against every head in CI order, continues through independent commands after
failure, and returns under 1000 tokens. Finish and consume one batch before
dispatching the next.

Treat repository workflows and scripts as untrusted code. The tester runs the
allowlisted commands from `TEST_WORKTREE` and returns command results; it
neither removes the worktree nor closes or reports on the parent-owned
`TREE_LEASE`. The parent closes each exact lease after consuming a completed
batch, and closes all retained leases on skipped, cancelled, or blocked paths.
Limit filesystem writes to that worktree and a temporary directory, deny network
by default, and remove ambient tokens, credential helpers, SSH agent sockets,
cloud credentials, and unrelated environment variables. Pass only the minimal
allowlisted toolchain environment. If this isolation is unavailable, or a
command genuinely needs network access or a credential, classify it as
hosted-only or ask the user for that specific
authority; never expose the parent session's credentials to a local CI command.

<report>

```yaml
sources_read: [<workflow-or-script-path>]
required_environment:
  - name: <variable name>
    declared_source: <workflow/package/.env source>
    worktree_status: present | missing | hosted-only
runnable_commands:
  - ref: <selected head SHA>
    command: <exact command>
    source: <path and job/script>
    status: <integer exit status>
    duration_seconds: <elapsed seconds>
    failure_evidence: <bounded stderr/stdout excerpt or null>
hosted_only:
  - check: <job or step>
    unavailable_requirement: <service, secret, runner, or credential>
expected_hosted_checks:
  - ref: <change-id or head SHA>
    names: [<workflow job or required status name>]
    sources: [<workflow path/job, branch protection, or ruleset>]
    inaccessible_sources: [<source and access error>]
overall: pass | fail | blocked | skipped
```

</report>

After consuming each batch report, the parent closes that batch's retained
leases and records the exact lease, tree, close status, and proof that both the
lease file and VCS registration are gone. A tester result cannot claim parent
cleanup. When a fixer changes a selected SHA, close every lease whose target
was superseded, retain unchanged undispatched leases, and recreate the affected
worktrees at their new exact SHAs before rerunning or continuing. On
cancellation or a terminal failure, close every lease still retained.

On local failure, diagnose captured output before editing and dispatch one
relevant fixer scoped to the root cause and affected files. It may edit and
returns under 1000 tokens:

<report>

```yaml
root_cause: <evidence-backed cause>
owning_change: <change-id or current-change>
files_edited: [<path>]
checks_run:
  - command: <exact command>
    status: <integer exit status>
    duration_seconds: <elapsed seconds>
unresolved: [<blocker>]
```

</report>

The parent reviews and accepts the diff, invokes
`coding:commit --retrospective`, then sends the tester to rerun affected
commands and the full runnable set. Publish only when every runnable command
exits zero. Any separate review is read-only. With `--skip-local-test`, retain
discovery and expected-check evidence but do not dispatch the tester.

### 3. Publish bottom-up

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

Select one archetype label for each head using the `GIT-PR-TYPE-01` selection
table. Before submitting each PR, preflight the repository labels before any
push or PR create/edit. If the selected label exists, attach it; if it is
unavailable, continue without it and record that it was skipped. Never create,
silently substitute, or require an unavailable label. Do not call any label
creation command. Bind the canonical set before either publication branch and
resolve repository names read-only:

```bash
ARCHETYPE_LABELS='["rfc","code-spec","contract","domain-model","implementation","integration","feature-flag","migration","ui","mechanical-refactor","cleanup","observability"]'
REPOSITORY_LABELS=$(gh label list --limit 1000 --json name)
AVAILABLE_ARCHETYPES=$(jq -c --argjson archetypes "$ARCHETYPE_LABELS" \
  '[.[].name | select(. as $name | $archetypes | index($name))]' \
  <<<"$REPOSITORY_LABELS")
```

Use `AVAILABLE_ARCHETYPES` for the existence check, stale-label cleanup, and
post-publication verification. Set `ARCHETYPE_AVAILABLE=true` only when the
selected label is in that array; otherwise set it to `false`, report the
skipped label, and omit every `--label`/`--add-label` operation for it. Split
each exact `title\n\nbody` into that head's `TITLE` and `BODY`; malformed output
aborts the whole selection before any ref or remote mutation.

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
When the head has no open PR, create a draft with the selected label only when
`ARCHETYPE_AVAILABLE=true`; otherwise create the draft without an archetype
label:

```bash
if [ "$ARCHETYPE_AVAILABLE" = true ]; then
  PR=$(gh pr create --draft --title "$TITLE" --body-file - \
    --base "$PR_BASE" --head "$BOOKMARK" --label "$ARCHETYPE" <<<"$BODY")
else
  PR=$(gh pr create --draft --title "$TITLE" --body-file - \
    --base "$PR_BASE" --head "$BOOKMARK" <<<"$BODY")
fi
```

When the head has one open PR, edit it and retain draft state. Discover its
current labels, remove every stale available archetype label, add the selected
one only when it is available, and verify one archetype label remains when
available and none remains when the selected label is unavailable:

```bash
gh pr edit "$PR" --title "$TITLE" --body-file - --base "$PR_BASE" <<<"$BODY"
CURRENT_LABELS=$(gh pr view "$PR" --json labels --jq '.labels[].name')
while IFS= read -r label; do
  if jq -e --arg label "$label" 'index($label) != null' <<<"$AVAILABLE_ARCHETYPES" >/dev/null &&
     [ "$label" != "$ARCHETYPE" ]; then
    gh pr edit "$PR" --remove-label "$label"
  fi
done <<<"$CURRENT_LABELS"
if [ "$ARCHETYPE_AVAILABLE" = true ]; then
  gh pr edit "$PR" --add-label "$ARCHETYPE"
fi
gh pr ready "$PR" --undo # skip only when already draft
```

After either create or update, verify the post-publication label invariant:

```bash
ACTUAL_ARCHETYPES=$(gh pr view "$PR" --json labels | jq -c --argjson archetypes \
  "$AVAILABLE_ARCHETYPES" \
  '[.labels[].name as $label | select($archetypes | index($label))] | sort')
if [ "$ARCHETYPE_AVAILABLE" = true ]; then
  EXPECTED_ARCHETYPES=$(jq -cn --arg label "$ARCHETYPE" '[$label]')
else
  EXPECTED_ARCHETYPES='[]'
fi
test "$ACTUAL_ARCHETYPES" = "$EXPECTED_ARCHETYPES"
```

Publish a genuinely necessary self-contained black-zone unit as a draft
without prior authorization only after its canonical body requires specific `## Risk`, `## Test plan`, and `## Why this size`
evidence for yellow/red/black as applicable. The draft is the discussion
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

Immediately after every initial publication, including `--skip-local-test`, run
this command with actual bottom-to-top PR URLs substituted:

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
   only for the root-commit fallback. Calculate the active `GIT-PR-SIZE-*`
   zone from that exact surface with:

   ```bash
   SIZE_JSON=$(uv run --python 3.13 \
     "${CODING_PR_SKILL_DIR}/scripts/classify-pr-size.py" \
     --repo "$REPO_ROOT" --base "$BASE_OID" --head "$HEAD_OID")
   ```

   Read `zone`, `files_changed`, and `net_loc` from `SIZE_JSON`. The classifier's
   file count includes every changed path and excludes generated-file
   additions and deletions only from authored net LOC. The canonical thresholds
   are fixed. Record the required sections for that zone. A black-zone change
   remains black and requires specific `## Risk`, `## Test plan`, and
   `## Why this size` evidence. Author them for the exact draft head/base pair
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
   - a red- or black-zone `## Why this size` contains specific indivisibility prose,
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
   [../templates/pr.md](../templates/pr.md) and continue.
   When the bundled default is also missing: exit 4, print the path that
   failed to resolve.
6. Fill the bundled default's placeholders from the commit body, diff, and
   recorded verification evidence:
   - `{{summary_paragraph}}` — first body paragraph (≤3 sentences); fall back
     to the subject text after `: ` when the body is empty.
   - `{{context_body}}` — content under `## Context` / `Why:` /
     `Background:`, if present.
   - `{{implementation_body}}` — content under `## Implementation` / `What:`
     / `How:`, if present.
   - `{{breaking_changes_body}}` — `BREAKING CHANGE:` footers; "None." when
     absent.
   - `{{rollback_body}}` — exact rollback steps or explicit forward-only
     mitigation. Required for the `migration` archetype.
   - `{{feature_flag_body}}` — flag name, default state, removal target, and
     rollout plan. Required for the `feature-flag` archetype.
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
     replace them; append items per the template's Verification guidance.
   - `{{boundary_body}}` — bullets naming related work the instruction placed
     outside this change, so its edges are not read as gaps. It records the
     scope it was given, not the author's own judgment calls. "None." when
     absent.
   - `{{additional_notes_body}}` — remaining unmapped body content; "None."
     when absent.

   Drop an optional section that resolves to "None." rather than leaving a
   stub. Never publish a generic or missing zone-required section; stop and
   report the missing evidence when it cannot be derived specifically. Strip
   every author-facing guidance comment from the rendered body — keep Summary
   and Verification always.
7. Emit the title line, a single blank line, then the Markdown body to stdout.
   Exit codes: `0` success, `2` unknown ref or non-conventional subject, `3` no
   commit source available, `4` bundled default template missing.

## Verification and Completion

- The title matches the Conventional Commits regex; a repo template is verbatim,
  or the bundled default has no placeholder or dropped-section stub. The same
  head OID, base/empty-tree OID, template, thresholds, and placeholder map yield
  byte-identical `title\n\nbody` without timestamps or random IDs.
- Local checks passed with every command/result recorded, or command execution
  was explicitly skipped; hosted-only gaps and expected checks are named.
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
