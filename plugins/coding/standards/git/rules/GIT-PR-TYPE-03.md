# GIT-PR-TYPE-03: Isolate Migrations from Logic

## Severity

error

## Intent

A database schema migration, data backfill, or configuration-format upgrade is
not mixed with business logic that consumes the migrated shape. The rendered
PR message also supplies rollback steps or an explicit forward-only mitigation.

## Scan

Inspect the implementation diff for migration artifacts and consumer logic.
Report the rule when both concerns appear in one PR, or when the selected
message lacks specific rollback evidence. Generated migration output remains
part of the migration concern.

## Fix

Separate migration artifacts from dependent behavior, and render the rollback
or forward-only mitigation through the selected PR message template. Each
resulting diff must remain independently valid. Use
[stacked-prs.md](../../../skills/pr/references/stacked-prs.md) for ordering.

## Edge Cases

- A column-only migration with no consumer change is one migration surface.
- An irreversible migration states that fact and provides a concrete
  forward-only mitigation.
- ORM schema changes and their generated SQL are one migration concern; code
  that reads or writes the new field is implementation.

## Related

GIT-PR-02, GIT-PR-SIZE-02, GIT-PR-TYPE-02, GIT-PR-STACK-04
