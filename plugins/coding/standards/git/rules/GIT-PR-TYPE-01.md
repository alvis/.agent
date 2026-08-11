# GIT-PR-TYPE-01: Declare PR Category

## Severity

error

## Intent

Every PR is classified as one of the 12 PR archetypes and carries that GitHub
label when the repository provides it. The category never appears as a title
prefix or PR-body section. Categorisation drives review depth; a repository
that lacks the selected label must not block publication.

The 12 labels are: `rfc`, `code-spec`, `contract`, `domain-model`, `implementation`, `integration`, `feature-flag`, `migration`, `ui`, `mechanical-refactor`, `cleanup`, `observability`. The selection table below owns archetype choice; the canonical PR template owns publication metadata and rendered or conditional body content.

## Fix

Select the archetype before publication. Before submitting each PR, list the
repository's existing labels read-only and attach the selected archetype only
when its exact label exists. If that label is unavailable, submit without the
archetype label and report it as skipped. Publication never creates, silently
substitutes, or requires an unavailable label.

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
