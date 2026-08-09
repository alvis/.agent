# GIT-PR-TYPE-03: Migrations Isolated from Logic

## Severity

error

## Intent

Database schema migrations, data backfills, and config-format upgrades land in dedicated `migration` PRs, never mixed with logic changes. The canonical PR template owns migration rollback evidence. Behaviour that depends on the migrated shape lands in a follow-up `implementation` PR, ideally behind a `feature-flag`.

## Fix

```text
order-archive/01-migration   feat(orders-db): add archived_at column
order-archive/02-flag        feat(orders): add orders.archive (default off)
order-archive/03-impl        feat(orders): use archived_at in archiveOrder
```

Author rollback and forward-only mitigation through the canonical PR template.

### Why this matters

- A migration that ships with logic changes cannot be rolled back independently.
- Reviewers of a migration look at lock duration, online-safety, and rollback; reviewers of logic look at correctness. Mixing forces both reviews onto every reviewer.
- Splitting migration first, flag second, impl third makes every step independently revertible.

## Edge Cases

- Trivial column-only migrations with literally no consumer change can ship as one PR if the change stays in green zone, with the template's rollback evidence.
- For migrations that cannot be rolled back, use the template's rollback section to state that explicitly and document the forward-only mitigation.
- ORM-driven migrations (Prisma, Drizzle) follow the same rule: the generated SQL plus the schema model are the migration; using the new fields is the implementation.

## Related

GIT-PR-TYPE-01, GIT-PR-TYPE-02, GIT-PR-STACK-04, GIT-PR-SIZE-02
