# Pull-Request Change Standards

_Scannable requirements for implementation diffs and rendered PR messages._

## Authority Boundary

This standard owns only violations detectable mechanically or semantically in
an implementation diff or rendered PR message. Each violation is an issue that
requires a fix.

[coding:commit](../../skills/commit/SKILL.md) owns commit, branch, and local
history directions. [create-update.md](../../skills/pr/references/create-update.md),
[stacked-prs.md](../../skills/pr/references/stacked-prs.md),
[review-workflow.md](../../skills/pr/references/review-workflow.md), and
[merge.md](../../skills/pr/references/merge.md) own PR directions. The PR skill's
[message.md](../../skills/pr/templates/message.md) and
[inline-review.md](../../skills/pr/templates/inline-review.md) own rendered
message shapes. Those directions and templates are not standards.

## Canonical Inputs

- [size-thresholds.json](../../skills/pr/assets/size-thresholds.json) is the
  sole numeric PR-size authority.
- [classify-pr-size.ts](../../skills/pr/scripts/classify-pr-size.ts) scans an
  exact committed base/head diff for size.
- [scan-pr-message.ts](../../skills/pr/scripts/scan-pr-message.ts) scans a
  rendered PR body against its selected template, exact revision, and
  conditional evidence.

## Exception Policy

Allowed exceptions only when:

- False positive
- No viable workaround exists now

Required exception note fields:

- `rule_id`
- `reason` (`false_positive` or `no_workaround`)
- `evidence`
- `temporary_mitigation`
- `follow_up_action`

Record the note in the PR discussion against the exact head and base OIDs.
Repository files cannot change the fixed PR-size thresholds.
`GIT-PR-SIZE-04` uses its separate exact-revision OWNER authorization gate,
not this exception policy.

## Rule Groups

- `GIT-PR-02`: Rendered PR-message conformance.
- `GIT-PR-SIZE-*`: Diff-size inputs, zones, evidence, and approval gates.
- `GIT-PR-TYPE-02..05`: Implementation-diff composition and generated output.
- `GIT-PR-STACK-04`: Feature-flag coverage for nontrivial behavior changes.
