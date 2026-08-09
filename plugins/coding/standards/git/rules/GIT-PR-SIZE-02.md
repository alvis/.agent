# GIT-PR-SIZE-02: Yellow Zone PR Size

## Severity

warning

## Intent

A yellow-zone PR changes **≤ 30 files** AND nets **≤ 1200 authored LOC** while
exceeding green thresholds. File count includes generated paths; LOC excludes
their additions and deletions under `GIT-PR-SIZE-01`.

The canonical PR template owns the additional evidence required for this zone.

The limits above are a human-readable projection of
`../../../skills/pr/assets/size-thresholds.json`, the sole numeric threshold
authority, and contract verification checks them against that asset.

## Fix

Author the PR body through the canonical template and supply its yellow-zone
evidence from the change; do not publish size counts or zone bookkeeping.

### Why this matters

- A yellow PR is large enough that "looks right" is not enough — the reviewer needs the author's mental model.
- Risk plus Test plan converts implicit confidence into explicit, reviewable claims.
- Yellow is a healthy zone: do not artificially shrink to green if the change is genuinely cohesive.

## Edge Cases

- Generated output can lower the LOC zone, but never the file-count zone. The
  Risk section remains required whenever either authored LOC or all-path file
  count places the PR in yellow.
- Yellow PRs that mix migration and logic must be split (`GIT-PR-TYPE-03`); an isolated atomic migration keeps its actual size zone.
- Repository configuration cannot move the asset-defined band.

## Related

GIT-PR-02, GIT-PR-SIZE-01, GIT-PR-SIZE-03, GIT-PR-TYPE-03, GIT-PR-STACK-04
