# GIT-PR-TYPE-05: Generated Files Isolated or Marked

## Severity

warning

## Intent

Generated artefacts (lockfiles, SDK output, OpenAPI clients, snapshot fixtures, schema dumps) either land in their own PR or are clearly marked inside a mixed PR so reviewers can skip them. Unmarked generator output mixed with hand-written code defeats review entirely — reviewers cannot tell which lines were authored.

## Fix

Preferred: split into a `mechanical-refactor` PR for the generated drop:

```text
api-sdk-bump/01-regen   chore(api-sdk): regenerate SDK from openapi.yaml
api-sdk-bump/02-consume feat(api): use new SDK fields
```

When any generated files are present, the canonical PR template owns the body
evidence. Prefer platform metadata such as `linguist-generated=true`, while
still satisfying that template.

If the project supports it, configure `linguist-generated=true` and `merge=ours` attributes for the generated paths so the diff is collapsed in review tooling.

### Why this matters

- A reviewer who reads every line of a 4000-LOC lockfile diff is reviewing nothing; a reviewer who skips it because they cannot tell what is hand-written is missing real bugs.
- Marking the generated portion explicitly converts the question "was this hand-written?" into a one-line answer.
- Generator inputs (the OpenAPI spec, the schema file, the codemod script) are themselves the cognitive load — those should be reviewed carefully.

## Edge Cases

- A generated file the team treats as authored (e.g. a vendored type-stub that humans edit) is not "generated" for this rule. Document the exception in the project's `standard-overrides`.
- Snapshot-update-only PRs are acceptable as `cleanup` or `mechanical-refactor` and benefit from the same split.
- Lockfile-only changes belong in their own PR (often a `chore`); they should never gate a feature stack.

## Related

GIT-PR-TYPE-01, GIT-PR-TYPE-04, GIT-PR-SIZE-03, GIT-PR-SIZE-04
