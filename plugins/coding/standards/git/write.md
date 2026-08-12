# Pull-Request Changes: Compliant Patterns

> **Prerequisite**: Read `meta.md` first for authority, inputs, exceptions, and
> rule groups. Use `scan.md` to verify the result.

## Key Principles

- Render and scan the selected PR message template.
- Classify size from the exact committed base/head diff.
- Keep spec, migration, mechanical, generated, and behavioral surfaces
  reviewable without hiding one concern inside another.
- Gate nontrivial behavior with a feature flag.
- Fix each violation in the implementation diff or rendered PR message that
  owns it.
- Follow [coding:commit](../../skills/commit/SKILL.md) for commit, branch, and
  local-history directions; follow the [PR router](../../skills/pr/SKILL.md) to
  load the selected authoring, stack, review, or merge directions.

## Core Rules Summary

### Rendered Message (`GIT-PR-02`)

- **GIT-PR-02**: Render the selected template without unresolved guidance,
  missing evidence, unknown sections, or out-of-order sections.

### Size (`GIT-PR-SIZE`)

- **GIT-PR-SIZE-01**: Derive file count, authored net LOC, and zone with the
  canonical classifier.
- **GIT-PR-SIZE-02**: Supply Risk and Test plan evidence outside green.
- **GIT-PR-SIZE-03**: Supply a specific indivisibility rationale in red.
- **GIT-PR-SIZE-04**: Supply all black message evidence and require live,
  exact-revision OWNER authorization before approval.

### Implementation Composition (`GIT-PR-TYPE`)

- **GIT-PR-TYPE-02**: Separate over-green public shape or scaffolding from implementation.
- **GIT-PR-TYPE-03**: Separate migrations from logic and document rollback.
- **GIT-PR-TYPE-04**: Separate mechanical work from behavior changes.
- **GIT-PR-TYPE-05**: Isolate or clearly mark generated outputs.

### Behavior Gating (`GIT-PR-STACK`)

- **GIT-PR-STACK-04**: Gate nontrivial behavior and document the flag.

## Canonical Outputs

- Author PR bodies from
  [message.md](../../skills/pr/templates/message.md), then run
  [scan-pr-message.py](../../skills/pr/scripts/scan-pr-message.py) with the
  exact head/base OIDs, zone, archetype, generated paths, and selected
  template.
- Run [classify-pr-size.py](../../skills/pr/scripts/classify-pr-size.py) against
  the exact committed base/head pair.
- Use each detailed rule guide for the smallest correction that makes the
  implementation diff or rendered message pass its mechanical and semantic
  scans.

## Anti-Patterns

- Treating a failed scanner as optional authoring advice.
- Estimating size or reproducing classifier arithmetic in prose.
- Calling a commit, branch, label, draft, stack, or merge operation a standard
  violation.
- Fixing a diff-composition violation with explanatory prose while leaving the
  implementation mixed.

## Quick Decision Tree

1. Authoring a PR body? Render and scan the selected message (`GIT-PR-02`).
2. Reviewing a diff? Classify its exact size (`GIT-PR-SIZE-*`).
3. Does the implementation mix concerns or generated output? Apply
   `GIT-PR-TYPE-02..05`.
4. Does it add nontrivial behavior? Verify its feature flag
   (`GIT-PR-STACK-04`).
5. Found a violation? Fix the owning diff or message and rescan.
