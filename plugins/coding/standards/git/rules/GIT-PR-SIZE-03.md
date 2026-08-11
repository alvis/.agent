# GIT-PR-SIZE-03: Red Zone PR Size

## Severity

warning

## Intent

A red-zone PR changes **≤ 60 files** AND has **≤ 2000 authored net LOC** while
exceeding yellow thresholds. Generated paths remain in the file count while
their additions and deletions are excluded from LOC under `GIT-PR-SIZE-01`.
Red PRs are allowed only when splitting would harm review (mechanical
refactors, generated files, atomic migrations). They require a concise,
specific explanation of why the review surface is indivisible. The canonical
PR template owns where and how that evidence is rendered. Red requires two
confirmed independent-reviewer evidence triplets bound to the exact head/base
OIDs.

The limits above are a human-readable projection of
`../../../skills/pr/assets/size-thresholds.json`, the sole numeric threshold
authority, and contract verification checks them against that asset.

## Fix

Author the PR body through the canonical template with a concrete indivisibility
rationale and two reviewer triplets. Keep size counts, zone metadata, and
review scheduling internal.

### Why this matters

- Without justification, a red PR signals an unsplit feature, not a cohesive change.
- Acceptable red-zone categories are narrow: `mechanical-refactor`, `migration`
  (atomic), `cleanup` (sweeping deprecations), and changes whose generated-file
  count crosses the red boundary despite modest authored LOC.

## Edge Cases

- Red PRs that interleave behaviour changes with mechanical edits violate `GIT-PR-TYPE-04`; split before submitting.
- A red PR whose justification is "feature too large to split" is a
  yellow-PR-shaped feature in disguise; re-plan it through
  [stacked-prs.md](../../../skills/pr/references/stacked-prs.md).
- Repository configuration cannot move the asset-defined band.

## Related

GIT-PR-SIZE-02, GIT-PR-SIZE-04, GIT-PR-TYPE-03, GIT-PR-TYPE-04,
GIT-PR-TYPE-05
