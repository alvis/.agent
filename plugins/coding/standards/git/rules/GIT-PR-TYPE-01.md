# GIT-PR-TYPE-01: Declare PR Category

## Severity

error

## Intent

Every PR has exactly one GitHub label named for one of the 12 PR archetypes.
The category never appears as a title prefix or PR-body section. Categorisation
drives review depth; an unclassified PR cannot be reviewed against the right
checklist.

The 12 labels are: `rfc`, `code-spec`, `contract`, `domain-model`, `implementation`, `integration`, `feature-flag`, `migration`, `ui`, `mechanical-refactor`, `cleanup`, `observability`. The selection table below owns archetype choice; the canonical PR template owns publication metadata and rendered or conditional body content.

## Fix

Select the archetype before publication, verify that its label already exists in
the repository, then attach exactly that label. If the label is absent,
publication blocks with the missing label named. Publication never creates or
silently substitutes repository labels.

### Selecting the category

| If the PR is mostly...                        | Use                      |
|-----------------------------------------------|--------------------------|
| A design proposal with no production code     | `rfc`                    |
| Types, interfaces, schemas, JSDoc only        | `code-spec`              |
| External-facing API/wire format               | `contract`               |
| Pure entities/value objects + unit tests      | `domain-model`           |
| Behaviour fulfilling existing types           | `implementation`         |
| Wiring, DI, end-to-end tests                  | `integration`            |
| Adding/flipping/removing a flag               | `feature-flag`           |
| Schema/data migration or backfill             | `migration`              |
| User-facing visual/interaction change         | `ui`                     |
| Renames, file moves, codemods                 | `mechanical-refactor`    |
| Dead-code or deprecation removal              | `cleanup`                |
| Logs, metrics, traces, dashboards             | `observability`          |

## Edge Cases

- A PR that is genuinely two categories (e.g. `migration` + `implementation`) violates `GIT-PR-TYPE-03` and must be split.
- The Conventional Commit type remains the only type marker in the PR title (`GIT-MSG-01`).
- Conditional body evidence for an archetype is owned by the canonical PR template.

## Related

GIT-MSG-01, GIT-PR-02, GIT-PR-TYPE-02, GIT-PR-TYPE-03, GIT-PR-TYPE-04, GIT-PR-TYPE-05, GIT-PR-STACK-01
