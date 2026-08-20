# Review Pull Request

Review a remote GitHub pull request and publish the result where the author will
act on it: one inline comment per finding, anchored to the exact file and line,
plus one overall review carrying the verdict. This skill owns remote PR review, its
publication, and the `GIT-PR-SIZE-*` standard handed over by `coding:pr create`
and `coding:pr update`. Local
pre-commit review belongs to `coding:review-code`; remediation to `coding:fix`.

## Boundaries

- Use for: reviewing an open GitHub PR by number, URL, or the path of a source tree
  holding its head; re-reviewing after a push; publishing line comments and a
  verdict to GitHub.
- Do not use for: reviewing uncommitted local work or writing work-local review
  artifacts (`coding:review-code`), fixing findings (`coding:fix`), mechanical
  standards enforcement (`coding:lint`), publishing PRs or driving CI
  (`coding:pr create` or `coding:pr update`), or merging (`coding:pr merge`).
- One reviewer per pass. Never fan out per area — a PR is sized so one reader can
  hold it whole, and split judgement produces split findings.

## Review directions

Read the implementation and every applicable standard. A standard violation or
predicted defect is an implementation finding and requires a fix. An unmet
operation, such as a stale base or pending rebase, is a process chore rather
than a code-priority claim.

Render anchored findings and chores through
[inline-review.md](../templates/inline-review.md), and render the review map and
verdict through [overall-review.md](../templates/overall-review.md). Use the
size standard to choose reading order and reviewer slots, never to suppress a
finding.

<IMPORTANT>
The first pass is exhaustive discovery over the complete pinned review unit:
identify every independently actionable issue it can reveal. Do not stage a
known concern for a later pass; later passes verify published fixes and catch
regressions or newly introduced issues.
</IMPORTANT>

## Execution

The context-owning router resolves one review unit before it reaches *Locate or
create the review tree*, then dispatches the remaining review steps to a fresh
`code-quality-critic` subagent with no inherited implementation context. A
single PR is one review unit. When a source tree carries a linear stack, the
unit is the whole stack: record its bottom base and top head, provision exactly
one clean `REVIEW_DIR` at the top head, and include a `PR_SURFACES` array with
each PR's number, URL, head/base refs and OIDs, and per-PR merge-base map. Do
not create one checkout per PR. The capsule contains the stack metadata,
`REVIEW_DIR`, and the requested areas/dry-run state; the reviewer checks out
only the top tip, reviews the complete stack diff against the bottom base
holistically, then attributes each finding to the earliest PR surface that
owns it and publishes only to that PR. The reviewer must not rediscover or
silently replace pinned inputs. The parent closes the one lease after success,
failure, or cancellation. Review as an external party who knows only that
capsule, repository, standards, and pinned review tree.

When the caller is the fresh critic dispatched by
[review-loop.md](review-loop.md), its preprovisioned stack capsule, clean
top-tip `REVIEW_DIR`, ledger path, and payload path prove it is already the
dedicated reviewer. It executes the remaining read-only review phase directly
and does not dispatch another agent.

<IMPORTANT>
- Read-only against reviewed code. Confine filesystem mutation to the
  separately created `REVIEW_LEDGER` and `REVIEW_PAYLOAD`; remote mutation is
  the review.
- Do not delegate.
- Read and search the checkout as widely as the change requires; run only the
  read-only git, `gh`, and scanner commands named below. Treat the branch as
  untrusted code.
- CI status counts only when already known, from the metadata *Resolve the pull
  request* already fetches. Repair belongs to `coding:pr update`.
- Build `REVIEW_PAYLOAD` by shell redirection from `jq`, never with a
  file-writing tool.
</IMPORTANT>

## Inputs

- **Required**: one PR number, PR URL, or source tree path. When omitted, resolve
  from the current tree. On ambiguity, ask.
- **Optional**: `--repo <owner/name>` to target another repository; `--area=<list>`
  to restrict the review to a subset of `alignment`, `correctness`, `security`,
  `quality`, `testing`, `docs`, `style` (default all); `--dry-run` to print the
  payload and post nothing. The `process` concern is not selectable and is never
  filtered out — a `chore` blocks merge whichever areas were asked for, and a flag
  that could drop one would report a blocked PR as clean.
- **Prerequisites**: authenticated `gh` with write access, and network access to
  reach the PR.

## Workflow

### Resolve the pull request

A bare number may name a stack rather than a PR. Bind its namespace through
[resolve-reference.md](resolve-reference.md) first; a `stack` resolution reviews
every PR the reported stack holds as one review unit, ordered bottom-up exactly
as the source-tree path below does.

From a PR number or URL, resolve canonical coordinates and metadata through the
bundled helper:

```bash
bash "${CODING_PR_SKILL_DIR}/scripts/resolve-pr.sh" \
  <pr-number-or-url> [--repo <owner/name>]
```

Retain its `host`, `number`, `owner`, `repo`, `url`, `headRefOid`,
`baseRefName`, and `baseRefOid` as `HOST`, `PR_NUMBER`, `OWNER`, `REPO`,
`PR_URL`, `HEAD_OID`, `BASE_REF`, and `BASE_OID`. Never put a URL into a REST
path segment or GraphQL `Int!` variable; pass `--hostname "$HOST"` to every
`gh api` call.

From a source tree path — or no argument at all, meaning the current tree — resolve
which PRs that tree carries. A tree may hold a whole stack, so match every open PR
head against its history rather than assuming one:

```bash
gh pr list --state open \
  --json number,url,headRefName,headRefOid,baseRefName,baseRefOid
git -C "$TREE" merge-base --is-ancestor "$HEAD_REF_OID" HEAD   # per candidate PR
```

Order the matches bottom-up by their base chain — each PR's `baseRefName` is the
previous PR's `headRefName` — and keep the chain as one review unit. The bottom
PR supplies `STACK_BASE_REF`/`STACK_BASE_OID`; the top PR supplies
`STACK_HEAD_REF`/`STACK_HEAD_OID`. Retain every matched PR's metadata in
`PR_SURFACES` so findings can be attributed to the change that introduced them,
but do not review each checkout independently. No match is a clean stop naming
the tree and its HEAD; an unresolvable tangle asks. Resolve every matched URL
through `resolve-pr.sh` before its review so all paths use the same coordinate
and metadata contract.

Stop with evidence when a PR is closed, merged, or unreadable. For a single PR,
record `HEAD_OID`, `BASE_REF`, and `BASE_OID`. For a stack, record the same fields
for every `PR_SURFACES` entry plus the stack bottom/top pair; all downstream
evidence binds to those exact objects.

### Select the change-tracking path

Prefer `jj` where it is available and genuinely initialized. Detect functionally — a
`.jj` and a `.git` directory can both be present without being colocated:

```bash
command -v jj >/dev/null 2>&1 && jj root >/dev/null 2>&1 &&
  [ "$(git rev-parse HEAD)" = "$(jj log -r @- --no-graph -T 'commit_id')" ]
```

Anything else selects git. This skill never mutates the repository, so a git-only
repository is fully supported and must not be colocated on its behalf.

### Locate or create the review tree

First create a secret-free handoff outside the review tree:

```bash
REVIEW_ARTIFACT_DIR=$(mktemp -d "${TMPDIR:-/tmp}/pr-review-${PR_NUMBER}-XXXXXX")
REVIEW_LEDGER="$REVIEW_ARTIFACT_DIR/ledger.json"
REVIEW_PAYLOAD="$REVIEW_ARTIFACT_DIR/payload.json"
```

The reviewer may write only those two files via `jq` redirection. Review-tree
cleanup must exclude them; after consuming both, the parent removes only
`REVIEW_ARTIFACT_DIR`.

For a local target repository, load [review-extraction.md](review-extraction.md)
now and fetch and verify both pinned objects before inspecting reuse candidates.
A clean tree already at the pinned review tip is then reusable without a new
checkout. For a single PR the tip is `HEAD_OID`; for a stack it is
`STACK_HEAD_OID`:

1. Search for a candidate at the review tip — the invoked tree first, then entries from
   `git worktree list --porcelain` and `jj workspace list`.
2. Accept one only when `git -C <tree> rev-parse HEAD` equals the review tip **and**
   `git -C <tree> status --porcelain` is empty. A dirty tree is not the PR head, and
   reviewing it would describe uncommitted work as if the author had pushed it.
3. With no candidate, the context-owning parent creates a disposable checkout
   and records that this run owns it:

   ```bash
   bash "${CODING_PR_SKILL_DIR}/scripts/temp-tree.sh" \
     <open-git-or-open-jj> <target-repository-root> "$REVIEW_TIP_OID"
   ```

For a fresh clone, the helper fetches the pinned head; immediately run the
reference's base fetch and final two-object verification inside that clone.
The same reference carries the cleanup contract. The parent retains its
returned `lease` as `TREE_LEASE`, passes its `tree` as `REVIEW_DIR`, and sets
`REVIEW_TREE_OWNED=true`. A stack never receives a second lease for a lower PR.

<IMPORTANT>
The parent closes only the exact helper-issued lease when `REVIEW_TREE_OWNED`
is true, including after subagent cancellation. A reused tree belongs to the
user and its removal would destroy real work.
</IMPORTANT>

### Read the existing discussion

The dedicated reviewer performs this phase after the parent has located or
created and verified `REVIEW_DIR`; it receives the pinned capsule and does not
repeat parent metadata discovery. Read issue comments, reviews, inline comments,
and review-thread state before reviewing. Page every connection; a partial
discussion cannot support a `fixed`, `does_not_apply`, or de-duplication
decision.

```bash
source "${CODING_PR_SKILL_DIR}/scripts/fetch-review-discussion.sh"
```

Page `reviewThreads` and each thread's `comments` connection to exhaustion.
Re-evaluate every existing P0/P1/P2 or mandatory-chore thread, including
resolved threads whose evidence commit differs from `HEAD_OID`.
For each previously reported issue, derive its verdict in every prior review where it
was evaluated. Compare the latest verdict with the immediately preceding review's
verdict; retain only issues whose verdict changed. The comparison is review-to-review,
not commit-to-commit, so several pushes between reviews do not create extra entries.

For every unresolved inline thread, inspect the pinned head for changes related to
the concern. When the change addresses the concern, check the thread's complete reply
history. If no reply records the published work, post one concise confirmation naming
the checked head and evidence; if such a reply already exists, do not post another.
Then resolve the thread:

```bash
gh api --hostname "$HOST" --method POST \
  "repos/$OWNER/$REPO/pulls/$PR_NUMBER/comments/$COMMENT_ID/replies" \
  -f body="$CONFIRMATION_REPLY" # only when no existing reply records the work

gh api graphql --hostname "$HOST" -F threadId="$THREAD_ID" -f query='
mutation($threadId:ID!){
  resolveReviewThread(input:{threadId:$threadId}){
    thread{isResolved}
  }
}'
```

Never resolve a thread whose concern still applies. Thread resolution records an
independent review verdict; it is not available to the agent that implemented or
published the change.

### Build the reviewable surface

Compare against the merge base, so the review covers the selected surface rather
than base-branch drift. For a stack, first build one holistic map from
`STACK_BASE_OID` to `STACK_HEAD_OID`; then derive each PR's changed-line map from
its recorded base/head pair while staying in that same top-tip tree. Use the
holistic read for cross-layer correctness, and use the per-PR maps only to place
comments on the PR that owns the finding:

| Path | Merge base | Changed files | Line map |
|---|---|---|---|
| jj | `jj log --no-graph -T 'commit_id' -r "heads(::$REVIEW_TIP_OID & ::$STACK_BASE_REF)"` | `jj diff --summary --from "$MERGE_BASE" --to "$REVIEW_TIP_OID"` | `jj diff --git --context=0 --from "$MERGE_BASE" --to "$REVIEW_TIP_OID"` |
| git | `git merge-base "$STACK_BASE_OID" "$REVIEW_TIP_OID"` | `git diff --name-status "$MERGE_BASE" "$REVIEW_TIP_OID"` | `git diff --unified=0 "$MERGE_BASE" "$REVIEW_TIP_OID"` |

Both paths emit unified diff, so one parser builds the holistic map and the
per-PR attribution maps. A finding that belongs to no individual surface stays
in that PR's overall review body rather than being copied to every PR.

<IMPORTANT>
The changed-line map is the anchoring contract. GitHub accepts an inline comment
only on a line present in the diff, so record per file every added line (RIGHT
side) and every removed line (LEFT). A finding that cannot anchor moves into the
overall body — never dropped, never posted against a guessed line.
</IMPORTANT>

Classify each size zone with the canonical read-only helper, then derive `ZONE`
from `SIZE_JSON`:

```bash
SIZE_JSON=$(bun run "${CODING_PR_SKILL_DIR}/scripts/classify-pr-size.ts" \
  --repo "$REVIEW_DIR" --base "$BASE_OID" --head "$HEAD_OID")
```

Use the classifier's all-path `files_changed` and generated-excluding authored `net_loc`.
Generated, vendored, and binary paths remain in the file count. Do not infer
the size zone from GitHub's collapsed diff presentation.

For a stack, classify each PR surface from its own head/base diff. The holistic
bottom-base-to-top-head diff supplies review context, not one replacement size
zone for every PR in the stack.

Use the classifier's returned zone. The table below explains that result for
review; do not inspect or reproduce the classifier's internal threshold data.

Every zone requires Summary, `## 🎯 Goal`, `## ✅ Requirements`,
`## 🧵 Context`, and `## 🧪 Verification`. The zone adds:

| Zone | Additional PR-body evidence |
|---|---|
| green | None |
| yellow | `## ⚠️ Risk`, `## 🧭 Test Plan`, and the policy-required reviewer evidence |
| red | Yellow evidence plus `## 📐 Why This Size` and the policy-required reviewer evidence |
| black | Red evidence plus full review of the self-contained unit; exact-revision OWNER authorization is required only for `APPROVE` |

A black-zone review first judges whether the surface is genuinely one
self-contained unit, then reviews it completely. Missing authorization does
not suppress findings or stop a `REQUEST_CHANGES` verdict. It caps only a
substantive `APPROVE` at `COMMENT`. Before approval, verify that the canonical
body supplies specific Risk, Test plan, and Why this size evidence.
Then judge only the live authorization helper receipt's `authorization_body`
and `rationale`: its atomic subject, coupling, and split consequence must be
specific. A generic or tautological indivisibility rationale blocks approval
despite structural helper acceptance. An earlier fetched comment or body cannot
authorize approval. Deleted, binary, generated, and vendored paths
carry no reviewable lines; list them as not reviewed.

### Run the mechanical candidate scan

```bash
bash "${CODING_PR_SKILL_DIR}/scripts/review-scan.sh" \
  <changed-files-in-review-tree> --category all --before 5 --after 10
```

The wrapper resolves Python 3.13+ and may route repair through `coding:sync-tool`;
surface a hard install failure rather than skipping silently. Candidates are
advisory until confirmed against the rule they cite.

### Resolve the applicable standards

Take standard paths from the "Plugin Constitution > Standards" sections of the
system prompt, or Glob `**/standards/**`. Always include `code-review/`,
`universal/`, `file-structure/`, `testing/`, and `documentation/`; include
`function/` for functions, methods, or APIs, and every language-specific
standard matching changed files. Apply testing standards to changed behavior
even when the PR adds no test file.

### Review

The diff is the subject of the review, not the limit of the reading.

- **Read whatever it takes.** Follow callers of a changed function, open the
  siblings a new file should resemble, read the module the change plugs into, the
  goal, and the spec. Understanding the change is the job; explore the checkout.
- **Judge only the diff.** Every finding is about something this PR changed. Read
  unchanged code to understand the change, not to grade it. Being about the diff and
  hanging off a line in it are different things: a deleted file and a chore the PR
  owes are squarely about the diff and anchor to nothing.
- **Ask whether the diff is the best solution**, not only whether it works: walk
  the lean ladder in [WORKFLOW.md](../../../references/WORKFLOW.md) — need,
  foundational modules, nearby code, platform, installed dependency, then
  minimum new code. Search code, content, tests, helpers, and fixtures;
  reinventing an available equivalent is a finding.
- **Prove the stated intent.** Trace each stated Goal and behavioral Requirement
  through implementation, callers, edge/failure paths, and tests. Behavior that
  diverges from the contract is a finding.
- **Apply the complete standards set.** Check file structure, testing,
  documentation, universal code, function/API, and every applicable
  language-specific standard resolved above.
- **Remove anything that earns no place.** Flag code, content, tests, helpers,
  or repetition whose deletion preserves required behavior and readability.
- **Say so when the change belongs somewhere else.** A guard repeated at each call
  site that belongs in the callee, validation in a controller that belongs in the
  domain, a symptom patched downstream of the function that produced the bad value —
  propose the better location and name the exact path. Never relocate it yourself.

Cover the concerns in consequence order — correctness and security, then alignment,
testing, quality, docs, style — in one pass. Record the goal/spec, intended
behavior, standards, reuse, and minimality verdicts from the checklist even
when they produce no finding.
[review-checklist.md](review-checklist.md) carries the per-concern checklist, the
depth ladder, and the finding schema;
[review-tone.md](review-tone.md) governs every word that gets posted, and
[inline-review.md](../templates/inline-review.md) owns the inline rendering.

`testing` answers one question above coverage: **would these tests fail if the
implementation regressed?** Assertions that restate the implementation, tests with
no meaningful assertion, mocks that verify only themselves, and new behavior with
no test at all are findings. Say what to test and why it matters, never a bare
"add tests".

### Anchor and de-duplicate

Keep a finding when its file and line appear in the changed-line map, setting `side`
to `RIGHT` for added lines or `LEFT` for removed ones. A finding that anchors to no
line moves to the overall body under the null-anchor rule in
[review-checklist.md](review-checklist.md), which owns what `subject` carries in
place of the anchor. Never invent a plausible line to keep a finding inline — an
unanchorable merge blocker is the one this step most has to survive. Then skip
whatever has
already been said at the same path and line:

```bash
gh api --hostname "$HOST" \
  "repos/$OWNER/$REPO/pulls/$PR_NUMBER/comments" --paginate \
  --jq '.[] | {path, line, body}'
```

A re-review after a push adds only what is new.

### Publish the review

For a black-zone surface whose substantive verdict is `APPROVE`, invoke the
fail-closed gate immediately before building that PR's `REVIEW_PAYLOAD`. For a
stack, run it for every black entry in `PR_SURFACES` that would receive
`APPROVE`, binding the command to the current entry's `PR_NUMBER`, `HEAD_OID`,
and `BASE_OID`:

```bash
bash "${CODING_PR_SKILL_DIR}/scripts/verify-black-zone-authorization.sh" \
  "$HOST" "$OWNER/$REPO" "$PR_NUMBER" "$HEAD_OID" "$BASE_OID"
```

The helper re-reads the live PR and accepts only the exact full head/base OIDs
and a five-line authorization comment from a human `OWNER`. Parse its compact
JSON receipt and require `comment_url`, `comment_id`, `comment_node_id`,
`author_login`, `head_oid`, `base_oid`, `authorization_body`, and the
`rationale.subject`, `rationale.coupling`, and `rationale.consequence` strings.
Use `authorization_body` and `rationale` as the sole semantic authorization-review input.
A missing, malformed, deleted, or mutated comment, API failure,
OID drift, or invalid receipt must cap the event at `COMMENT` and record
`authorization_required`; never reuse an earlier receipt or substitute a
comment body fetched before this invocation.
`REQUEST_CHANGES` remains publishable without authorization because it cannot
approve the PR. The review workflow never authors the OWNER comment.

Build the body from [overall-review.md](../templates/overall-review.md) and each
anchored comment from [inline-review.md](../templates/inline-review.md). Submit
the whole review in one atomic call, so a rejected comment cannot leave
orphaned fragments:

```bash
gh api --hostname "$HOST" --method POST \
  "repos/$OWNER/$REPO/pulls/$PR_NUMBER/reviews" --input "$REVIEW_PAYLOAD"
```

`REVIEW_PAYLOAD` carries `commit_id` (the pinned `HEAD_OID`), `body`, `event`, and
`comments[]` of `{path, line, side, body}`. Payload construction and 422 recovery
are in [review-publishing.md](review-publishing.md).

Immediately before building the payload, re-resolve the PR metadata and compare
`headRefOid`, `baseRefName`, and `baseRefOid` with the pinned values. For a stack,
repeat that comparison for every `PR_SURFACES` entry, including the bottom and
top pair. If any head or base moved, stop with a concurrency blocker, do not
build or submit a payload, and record the new remote values for the caller.
The verdict depends on all three objects, so a check that runs after the review
is submitted came too late to change anything.

Derive `event` in three ordered steps; never choose it freely.

**1. Grade the findings.** This is the *substantive verdict* — what the review
concluded about the code. It is the value the body's alerts key off, so it is recorded
even when a later step rewrites what gets submitted:

| Outstanding findings | Substantive verdict |
|---|---|
| Any P0/P1 finding, or any `chore` | `REQUEST_CHANGES` |
| Only P2/P3/P4, only kinds other than `chore`, or nothing at all | `APPROVE` |

These two rows are exhaustive — every review lands on exactly one, and nothing else
qualifies the grade. Whether the tests convince belongs to step 2, not here: it caps
what may be submitted without changing what the findings concluded, and folding it in
as a third condition would leave a review with weak tests and only P3 findings
matching no row at all while the body still needs a substantive verdict to key off.

**2. Cap the event where the review cannot be trusted.** Tests unconvincing, red CI,
a head/base value no longer equal to its pinned value, or a blocker
prevented a full review: the event is capped at `COMMENT`. The cap beats step 1 rather than competing
with it. A P0 raised against a revision that is no longer the head is not a blocker you
can stand behind, and `REQUEST_CHANGES` on evidence that moved underneath you claims a
certainty the review does not have.

`chore` is the only kind that reaches step 1; `question`, `thought`, `note`, and
`praise` never hold a verdict on their own. A review carrying nothing but those is a
substantive `APPROVE`; unconvincing tests then cap the event in step 2 rather than
unsettling what step 1 concluded.

`goal_spec_alignment: skipped_unknown` does not hold the verdict either. A change with
no goal or spec to resolve is the ordinary case, not a concern that failed to run, so
disclose it in the body and derive `event` from the findings and the tests as usual.
What does hold the verdict is a concern that could not run when there was something to
check — that is the cap in step 2.

For black-zone reviews, apply the approval-time authorization gate above after
these general trust caps. It can change only `APPROVE` to `COMMENT`; it never
downgrades `REQUEST_CHANGES`.

**3. Downgrade a self-review.** GitHub rejects `APPROVE` and `REQUEST_CHANGES` on your
own PR. Compare the author against
`gh api --hostname "$HOST" user --jq .login` first; on a self-review,
submit `COMMENT` and say so in the body. This step rewrites only what is submitted —
the substantive verdict from step 1 survives it and still drives the body's alerts, so
a blocker found on your own PR is still presented as one rather than as an observation
GitHub happened to accept.

With `--dry-run`, print the payload and post nothing.

## Verification

- The review recorded whether the implementation delivers the stated Goal and
  behavioral Requirements, whether every applicable standard was followed,
  whether existing helpers/content/tests
  were missed, and whether any code/content/tests can be removed unchanged.
- Confirm the head, base-ref, and base-OID comparisons ran for every surface before
  the payload was built; any moved value blocked publication and is stated plainly
  in the ledger — the published review describes only the pinned stack it read.
- A created review tree is gone and leaves no entry in `jj workspace list` or
  `git worktree list`; a reused tree is untouched, still clean, still at `HEAD_OID`.
- Every posted comment resolves to a line in the changed-line map and duplicates
  nothing already on the PR.
- Every existing P0/P1/P2 or mandatory-chore thread required above was
  re-evaluated against `HEAD_OID` and reported as `still_applies`, `fixed`, or
  `does_not_apply`; every fixed or inapplicable unresolved thread was resolved,
  with exactly one work-confirmation reply when its history previously had none.
- Every overall-review finding, including a null-anchor finding, has a stable
  key, priority, kind, review ID/URL, summary, evidence OID, and disposition;
  P0/P1/P2 and mandatory chores are explicitly re-evaluated on later heads.
- `BASE_REF` and `BASE_OID` still match the reviewed base before publication.
- The submitted `event` matches the verdict table, or the self-review downgrade is
  stated in the body.

## Completion

Write the detailed secret-free finding/thread ledger to a durable temporary
file. Return its absolute path and a structured report below 1000 tokens with,
per PR: review URL, reviewed head/base refs and OIDs, review tree and ownership,
tracking path, zone, goal/spec and intended-behavior
alignment, standards alignment, reuse, minimality, finding counts by priority and kind,
submitted event, trust cap or `none`, unanchored count, paths not reviewed, and
blocker. An outstanding `chore` is a
merge blocker and must never be summarized as zero findings. Preserve stack
order. The ledger includes every existing P0/P1/P2 or mandatory-chore thread's
disposition and every overall-review finding (anchored or unanchored), keyed to
the evidence OID, so a publication caller acts only after independent
confirmation. A later head must re-evaluate any high-priority finding whose
evidence OID changed.
A partial review is never reported as complete.
