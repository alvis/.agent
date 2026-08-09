# GIT-PR-SIZE-04: Black Zone PR Size

## Severity

warning

## Intent

A black-zone PR changes **> 60 files** OR **> 2000 LOC**. It remains black:
repository configuration cannot change these thresholds. A genuinely
self-contained unit may be pushed as a draft and tested without prior
authorization only when its canonical PR body supplies specific Risk, Test
plan, and Why this size evidence. Review approval blocks until its exact
surface receives one-off OWNER authorization in the PR discussion.

## Fix

Report this finding once; do not auto-post a canned PR comment:

```text
Black-zone PR: keep one self-contained review unit; exact-revision OWNER authorization is required before approval.
```

If splitting is genuinely impossible, the OWNER must author a PR discussion
comment, as a human GitHub user with `author_association=OWNER`, in this form:

```text
Black-zone authorization
Head OID: `<full-oid>`
Base OID: `<full-oid>`
Authorization: I authorize this one-off black-zone publication.
Indivisibility: <atomic subject> because <coupling>; otherwise <consequence>
```

The comment has exactly these five ordered nonempty lines, with no extra or
duplicate marker lines. The helper verifies this structure and returns the
live matched comment as one structured receipt. Full review uses only that
receipt's `authorization_body` and `rationale` to judge whether the named
subject, coupling, and consequence are specific to the change; a generic or
tautological rationale is a blocking finding. An earlier fetched comment or
body cannot authorize approval.

The authoring workflow may push the exact draft head/base pair, run CI, and
dispatch review without prior authorization. Immediately before a black-zone
review would submit `APPROVE`, it verifies the live comment mechanically with
`verify-black-zone-authorization.sh`. Failure caps that event at `COMMENT` and
returns `authorization_required`; it does not suppress review findings or a
`REQUEST_CHANGES` verdict. The workflow never creates or edits an
exception/configuration file and never posts the authorization itself. PR
bodies, reviews, bot or non-OWNER comments, stale OIDs, structurally invalid
comments, and generic or tautological rationales never count. Any head or base
OID change invalidates the comment.

### Why this matters

- Reviewer recall drops sharply past ~60 files; bugs hide in the long tail of the diff.
- Exact-revision OWNER authorization preserves engineering judgment for a
  legitimate atomic change without weakening the canonical thresholds.

## Edge Cases

- A black PR that is 95 % `GIT-PR-TYPE-05` generated files (for example, SDK regeneration) may justify authorization, but remains black and receives a full review.
- A black PR opened for "speed of review" contradicts the rule — speed is exactly what the zone threshold protects.
- Authorization is one-off and revision-bound; it cannot establish a repository-wide exception.

## Related

GIT-PR-SIZE-02, GIT-PR-SIZE-03, GIT-PR-TYPE-02, GIT-PR-TYPE-03, GIT-PR-TYPE-04, GIT-PR-TYPE-05, GIT-PR-STACK-05
