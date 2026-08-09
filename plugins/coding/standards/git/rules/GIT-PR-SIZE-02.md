# GIT-PR-SIZE-02: Yellow Zone PR Size

## Severity

warning

## Intent

A yellow-zone PR changes **≤ 30 files** AND nets **≤ 1200 LOC** while exceeding green thresholds. Yellow PRs are mergeable but require the author to surface risk explicitly so a reviewer can focus on what matters.

The canonical PR template owns the additional evidence required for this zone.

## Fix

Author the PR body through the canonical template and supply its yellow-zone
evidence from the change; do not publish size counts or zone bookkeeping.

### Why this matters

- A yellow PR is large enough that "looks right" is not enough — the reviewer needs the author's mental model.
- Risk plus Test plan converts implicit confidence into explicit, reviewable claims.
- Yellow is a healthy zone: do not artificially shrink to green if the change is genuinely cohesive.

## Edge Cases

- A yellow PR composed mostly of generated files may move down to green-equivalent review effort if marked per `GIT-PR-TYPE-05`. The Risk section is still required because the generator change itself is the risk.
- Yellow PRs that mix migration and logic must be split (`GIT-PR-TYPE-03`); an isolated atomic migration keeps its actual size zone.
- Override numeric thresholds via `[git.pr.thresholds]` in standard-overrides; the section requirements stay attached to the yellow zone regardless of where the band sits.

## Related

GIT-PR-02, GIT-PR-SIZE-01, GIT-PR-SIZE-03, GIT-PR-TYPE-03, GIT-PR-STACK-04
