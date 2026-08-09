# GIT-PR-SIZE-01: Green Zone PR Size

## Severity

warning

## Intent

A green-zone PR changes **≤ 15 files** AND nets **≤ 500 authored LOC**.
Green PRs are the default-mergeable unit of work — small enough that a
reviewer can hold the entire diff in their head, fast enough that turnaround
does not stall a stack.

A PR's zone is the stricter of the two metrics: 12 files / 600 authored net
LOC is yellow, not green. Every changed path counts toward the file metric.
Generated-file additions and deletions do not contribute to the LOC metric.

The limits above are a human-readable projection of
`../../../skills/pr/assets/size-thresholds.json`, the sole numeric threshold
authority, and contract verification checks them against that asset.

## Fix

Run `../../../skills/pr/scripts/classify-pr-size.py` through Python 3.13 against the
exact base/head pair, then author the body through the canonical PR template.
Do not add file counts, LOC, or zone bookkeeping to the PR body.

### Why this matters

- Reviewer working memory is the binding constraint, not LOC alone.
- Green PR body requirements are owned by the canonical PR template (`GIT-PR-02`).
- Stacks are healthier when each layer fits in green — splits become natural, not forced.

## Edge Cases

- Package lockfiles such as `pnpm-lock.yaml`, and paths marked
  `linguist-generated=true`, contribute no LOC but still count as changed
  files. Mark them per `GIT-PR-TYPE-05` so reviewers know their generator.
- Tests count toward LOC. A green-LOC PR with a 400-line test file is still green; do not split tests away from the code they cover.
- A generated file not covered by the classifier's deterministic lockfile or
  Git-attribute contract remains authored for LOC sizing.
- Uncommitted `.git/info/attributes`, global/system attributes, and external
  diff configuration never classify a path or change its line count; only the
  committed base/head inputs do.

## Related

GIT-PR-02, GIT-PR-SIZE-02, GIT-PR-SIZE-03, GIT-PR-SIZE-04, GIT-PR-TYPE-05
