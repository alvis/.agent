# Create or Update Pull Requests

## Workflow at a glance

1. Resolve the requested change or linear stack, its GitHub push remote, open
   PRs, exact heads and bases, and the required PR shape.
2. Run applicable pull-request tests and lint through `jj run`: integrated tip
   first, then every independently publishable surface bottom-up.
3. Publish saved bookmarks bottom-up, author and scan each PR body, apply its
   available archetype label, and verify the remote head, base, draft state,
   body, and labels.
4. Perform PR review with a fresh independent subagent unless explicitly
   skipped, converging findings by repairing the owning change and restarting
   invalidated discovery and verification gates.
5. Poll every published PR until hosted CI is green; diagnose the first red
   surface, fix its root cause, republish, and repeat without hiding blockers.

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

For each head, choose the `--archetype` value accepted by
`scripts/scan-pr-message.py` that best describes its implementation surface.
This controls conditional body evidence and scanner behavior only; repository
labels come only from the receiving repository's live inventory below.

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
- Before every push, unless the caller explicitly supplied `--no-verify`, run
  the applicable `pull_request` test and lint tasks through read-only `jj run`
  at exact revision anchors. Run the selected tip first as a canary, then every selected
  PR surface bottom-up through the tip. A missing required secret is the only
  per-surface exception: stop and ask the user either to supply it from an
  explicit source or to approve that exact revision and the exact lexically sorted
  missing-secret names. Never infer approval from another flag or caller,
  guess a secret source, pass an empty value, or push after any other local
  failure.
- `--no-verify` skips only this invocation's local revision-bound parity gate and
  must be recorded with every skipped bookmark and PR. It never skips hosted
  CI, review, publication checks, or authoring checks and is never implied by
  `--no-review`, `--publish-only`, a commit-time flag, or missing secrets.
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
| `--no-verify` | Explicitly skip the local revision-bound test/lint gate for this publication only. Record every skipped bookmark and PR; hosted CI and all other publication gates remain mandatory. |
| `--no-review` | Skip the post-push `coding:pr review` convergence loop. It never skips local checks, publication, or hosted CI. |
| `--max-iteration <count>` | Set the maximum number of attempted exhaustive whole-stack reviews. Reject before mutation unless `<count>` is an ASCII decimal integer greater than zero; the default is `3`. |
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
  prerequisites. Unless `--no-verify` is explicit, local CI parity additionally
  requires jj 0.44 or newer, an initialized colocated repository, and exact
  target resolution so every test and lint task can run through `jj run`; follow
  the shared jj guide and `coding:sync-tool` instead of substituting a Git
  runner.

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
source "${CODING_PR_SKILL_DIR}/scripts/resolve-push-remote.sh"
```

Record `REMOTE` and `PUSH_OWNER` in the publication plan. On zero or ambiguous
GitHub candidates, preserve the candidate evidence and stop rather than selecting
one.

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
immutable revision IDs. Encode them in `SELECTED_STACK_JSON` as objects with `head` and
`base` fields plus the discovered `bookmark` and PR identity, ordered bottom-up;
a standalone target has one object. Derive the canary target from that map: the
last selected head is the target revision and the first selected head's base is
the target base revision. The tip's immediate PR base is not the selected canary base.

```bash
source "${CODING_PR_SKILL_DIR}/scripts/select-verification-target.sh"
```

With `--no-verify`, record `local_verification: skipped_by_user` with the exact
ordered bookmark, PR, head, and base map, then continue to publication. Do not
create a parity receipt, treat the skip as a missing-secret approval, or reuse
the skip after this invocation.

Otherwise invoke the public parity action with the three bound canary inputs:

```text
coding:pr verify --target "$TARGET_SHA" --base "$TARGET_BASE" --kind "$TARGET_KIND"
```

For a standalone surface, that successful canary is the complete local gate.
For a stack, a successful canary proves the integrated tip first; next, rebind
`TARGET_SHA` and `TARGET_BASE` to each object's `head` and immediate `base`, set
`TARGET_KIND=standalone`, and invoke the same public action bottom-up through
the tip. The tip is deliberately run again against its immediate PR base so
both the integrated stack and every independently publishable PR surface have
exact evidence.

If the canary is red, do not push or repair it immediately. Run the same action
bottom-up until the first red surface. The first failure is the earliest broken
bookmark/PR even when a later commit masks that failure at the tip; retain its
command output and the verifier's diagnosis. Stop the traversal there, fix the
root cause in that owning change through `coding:commit` and the shared `jj edit`
route when applicable, then restart stack discovery and the entire tip-first
gate. If the canary is green but a bottom-up surface is red, apply the same
earliest-surface rule. Never test higher surfaces after the first bottom-up
failure because their inputs will be invalidated by the repair.

For every successful action, capture its complete `CI_PARITY_RECEIPT_JSON`, its canonical
`CI_PARITY_EXPECTED_WORKFLOW_COMMAND_RESULTS_JSON`, and its canonical
`CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON`; bind the receipt to the
surface's bookmark and PR identity. Consume each receipt immediately and replay
the same gate for the complete ordered receipt set before every entry or
re-entry to publication:

```bash
source "${CODING_PR_SKILL_DIR}/../../scripts/validate-ci-parity-receipt.sh"
```

A rewrite, base-map change, bookmark/PR identity change, or command/result-set
change invalidates the complete receipt set and restarts discovery before this
step.

### 3. Publish bottom-up

Before every entry or re-entry to this phase, either confirm the invocation's
explicit `--no-verify` record still matches the complete selected stack or
rerun the receipt gate above against every current bound surface in the ordered
receipt set. On a missing-secret exception path, each approval's `sha` equals
that surface's exact `TARGET_SHA` and its `names` equal the verifier's exact
lexically sorted missing-secret names. A SHA-only approval or any name/order
mismatch, like a missing surface receipt, returns to step 2 before a remote
mutation.
For each rebound surface, its `sha` equals the exact `TARGET_SHA`; its sorted
names and complete receipt remain inseparable from that target.

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

#### Discover and select repository labels

Bind `HOST` and `REPOSITORY` to the receiving repository for this PR, using
the existing PR URL on update or the intended PR target on create. Fetch its
complete label inventory before publication:

```bash
REPOSITORY_LABELS=$(bash \
  "${CODING_PR_SKILL_DIR}/scripts/list-repository-labels.sh" \
  "$HOST" "$REPOSITORY")
```

<IMPORTANT>
The helper returns deterministic JSON containing every exact label `name` and
`description` from every API page. Inspect both fields and choose zero or more
suitable names only from that output. Never create, guess, substitute, or
remove labels. Set `SELECTED_LABELS` to a JSON array of those exact choices,
including `[]` when no label is suitable.
</IMPORTANT>

#### Validate selected repository labels

Validate every per-head selection before any ref or remote mutation:

```bash
jq -e --argjson repository_labels "$REPOSITORY_LABELS" '
  type == "array" and all(.[];
    type == "string" and
    (. as $selected | any($repository_labels[]; .name == $selected))
  )
' \
  >/dev/null <<<"$SELECTED_LABELS" || exit $?
```

Split each exact `title\n\nbody` into that head's `TITLE` and `BODY`; malformed
output aborts the whole selection before any ref or remote mutation.

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
every affected unmerged bookmark and its exact expected local revision anchor
for the single batch publication below.

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
When the head has no open PR, create a draft:

```bash
PR=$(gh pr create --repo "$HOST/$REPOSITORY" --draft --title "$TITLE" --body-file - \
  --base "$PR_BASE" --head "$PUSH_OWNER:$BOOKMARK" <<<"$BODY")
```

When the head has one open PR, edit it and retain draft state:

```bash
source "${CODING_PR_SKILL_DIR}/scripts/update-pr.sh"
```

#### Attach selected repository labels

After either path binds `PR`, add nonempty selections as JSON so commas
remain inside exact names. This endpoint adds to existing labels; it does not
remove them.

```bash
if jq -e 'length > 0' >/dev/null <<<"$SELECTED_LABELS"; then
  PR_NUMBER=$(gh pr view "$PR" --repo "$HOST/$REPOSITORY" \
    --json number --jq .number)
  jq -ce '{labels: .}' <<<"$SELECTED_LABELS" |
    gh api --method POST --hostname "$HOST" \
      "repos/$REPOSITORY/issues/$PR_NUMBER/labels" --input - >/dev/null
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

For a top-level create or update, the owning main agent retains
`MAX_ITERATION` from `--max-iteration` or its default and starts
`REVIEW_ITERATION` at zero in its working context. It keeps both values across
nested publish-only and CI-repair calls without putting them on another CLI;
only [review-loop.md](review-loop.md) increments the current iteration.

After every selected head is pushed or updated and its remote OID is verified,
load and follow [review-loop.md](review-loop.md), unless `--no-review` is
present. A review-driven fix republishes the affected stack, resets the expected
head OIDs, and runs the loop again with a fresh subagent before CI monitoring.
If the loop returns `action: repair_ci_then_review`, enter step 5 immediately
without marking review convergence complete or attempting another review
against unchanged CI.
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

If the loop returns `action: review_exhausted`, record the unresolved findings
and enter step 5. Converge hosted CI normally; once it is green, report green CI
and missing substantive approval instead of dispatching another review.

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
- Unless `--no-verify` was explicitly recorded, the applicable `pull_request`
  test and lint tasks passed through read-only `jj run` first at the exact
  selected tip and then at every selected PR head bottom-up, with
  revision-bound sources and results. The sole per-surface exception records
  the user's explicit approval for that exact revision and the verifier's exact
  lexically sorted missing-secret names. A
  `--no-verify` run instead reports every skipped bookmark, PR, head, and base;
  hosted CI remains mandatory.
- Every head was pushed under a lease — one explicit affected-bookmark
  `jj git push` on the jj path,
  `git push --force-with-lease` on the git path; every PR is draft, uses the
  authored title/body, and has the intended stack base.
- Review convergence produced a substantive `APPROVE` on each final head,
  including required replies and repair heads;
  `--no-review` was explicitly recorded; or the configured review maximum was
  exhausted and green CI plus missing substantive approval is reported.
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
