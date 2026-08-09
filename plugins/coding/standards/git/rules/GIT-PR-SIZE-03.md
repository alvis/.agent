# GIT-PR-SIZE-03: Red Zone PR Size

## Severity

warning

## Intent

A red-zone PR changes **≤ 60 files** AND nets **≤ 2000 LOC** while exceeding yellow thresholds. Red PRs are allowed only when splitting would harm review (mechanical refactors, generated files, atomic migrations). They require a concise, specific explanation of why the review surface is indivisible. The canonical PR template owns where and how that evidence is rendered.

## Fix

Author the PR body through the canonical template with a concrete indivisibility
rationale. Keep size counts, zone metadata, and review scheduling internal.

### Why this matters

- Without justification, a red PR signals an unsplit feature, not a cohesive change.
- Acceptable red-zone categories are narrow: `mechanical-refactor`, `migration` (atomic), `cleanup` (sweeping deprecations), and PRs dominated by `GIT-PR-TYPE-05` generated files.

## Edge Cases

- Red PRs that interleave behaviour changes with mechanical edits violate `GIT-PR-TYPE-04`; split before submitting.
- A red PR whose justification is "feature too large to split" is a yellow-PR-shaped feature in disguise — re-plan as a stack (`GIT-PR-STACK-*`).
- The numeric thresholds are fixed; repository configuration cannot move this band.

## Related

GIT-PR-SIZE-02, GIT-PR-SIZE-04, GIT-PR-TYPE-03, GIT-PR-TYPE-04, GIT-PR-TYPE-05, GIT-PR-STACK-05
