# GIT-PR-SIZE-01: Green Zone PR Size

## Severity

warning

## Intent

A green-zone PR changes **≤ 15 files** AND nets **≤ 500 LOC**. Green PRs are the default-mergeable unit of work — small enough that a reviewer can hold the entire diff in their head, fast enough that turnaround does not stall a stack.

A PR's zone is the stricter of the two metrics: 12 files / 600 LOC is yellow, not green.

## Fix

Calculate size internally and author the body through the canonical PR template.
Do not add file counts, LOC, or zone bookkeeping to the PR body.

### Why this matters

- Reviewer working memory is the binding constraint, not LOC alone.
- Green PR body requirements are owned by the canonical PR template (`GIT-PR-02`).
- Stacks are healthier when each layer fits in green — splits become natural, not forced.

## Edge Cases

- Generated files (lockfiles, snapshots) inflate LOC without inflating cognitive load. Mark them per `GIT-PR-TYPE-05` and a reviewer may still treat the PR as green in spirit.
- Tests count toward LOC. A green-LOC PR with a 400-line test file is still green; do not split tests away from the code they cover.
- Generated content may reduce reading effort, but it never changes the fixed zone calculation.

## Related

GIT-PR-02, GIT-PR-SIZE-02, GIT-PR-SIZE-03, GIT-PR-SIZE-04, GIT-PR-TYPE-05
