# GIT-PR-TYPE-02: Separate Public Shape from Implementation

## Severity

error

## Intent

An over-green implementation diff does not introduce public types, interfaces,
schemas, contracts, or required scaffolding together with the behavior that
fulfills them. The mixed surface forces reviewers to settle API shape while
also verifying its implementation.

## Scan

Inspect the diff semantically. Report the rule when externally consumed shape
or prerequisite scaffolding and its runtime behavior appear in the same PR and
the combined surface exceeds green. Inferable internal types are implementation,
not a separate public-shape concern.

## Fix

Separate the public shape or prerequisite scaffolding from the behavior. Each
resulting diff must compile, test, and remain reviewable on its own; follow
[stacked-prs.md](../../../skills/pr/references/stacked-prs.md) to arrange the
resulting changes.

For example, one diff may add `ArchiveOrderInput` and `ArchiveReason`, while a
separate implementation diff adds `archiveOrder()` against that settled shape.

## Edge Cases

- A tiny cohesive feature whose combined diff remains green may keep its shape
  and implementation together.
- Inferable types private to one function or module do not require separation.
- External API and wire-format contracts receive the same semantic scan even
  when their source is generated.

## Related

GIT-PR-SIZE-01, GIT-PR-TYPE-03, GIT-PR-TYPE-04
