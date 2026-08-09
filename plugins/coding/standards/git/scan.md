# Git Workflow: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

Any single violation blocks submission by default.
If a violation is detected, load the matching rule guide at `./rules/<rule-id>.md`.

## Quick Scan

- DO NOT use a wrong or missing commit type prefix [`GIT-MSG-01`]
- DO NOT use directory paths as scope instead of short package names [`GIT-MSG-02`]
- DO NOT exceed the 72-character hard limit for commit titles [`GIT-MSG-03`]
- DO NOT use past tense or non-imperative mood in commit titles [`GIT-MSG-04`]
- DO NOT use `Fixes` or `Resolves` in footers instead of `Closes` [`GIT-MSG-05`]
- DO NOT exceed the 72-character wrap limit for commit body lines [`GIT-MSG-06`]
- DO NOT use more than 2 comma-separated scopes [`GIT-MSG-07`]
- DO NOT use camelCase or underscores in branch names instead of lowercase-kebab-case [`GIT-BRN-01`]
- DO NOT use branch scopes that don't follow the commit scope convention, except an engineering stream's branch — shape owned by `naming.md` in the essential plugin's `references/` — whose middle segment is the work ID, not a package scope [`GIT-BRN-02`]
- DO NOT create PRs as ready-for-review without starting as draft [`GIT-PR-01`]
- DO NOT publish a PR body that violates the canonical PR template [`GIT-PR-02`]
- DO NOT use PR titles that don't follow the commit message format [`GIT-PR-03`]
- DO NOT submit a PR outside the green zone without the evidence required by the canonical PR template [`GIT-PR-SIZE-02`]
- DO NOT submit a red-zone PR without a concise indivisibility rationale [`GIT-PR-SIZE-03`]
- DO NOT publish a black-zone draft without specific Risk, Test plan, and Why this size evidence, or approve it without exact-revision OWNER authorization in the PR discussion [`GIT-PR-SIZE-04`]
- DO NOT publish a PR without exactly one existing GitHub archetype label [`GIT-PR-TYPE-01`]
- DO NOT mix code spec or scaffolding with implementation in the same PR [`GIT-PR-TYPE-02`]
- DO NOT mix database or config migrations with logic changes in the same PR [`GIT-PR-TYPE-03`]
- DO NOT mix mechanical refactors (renames, file moves) with behaviour changes [`GIT-PR-TYPE-04`]
- DO NOT mix generated files with hand-written changes without a clear marker or separation [`GIT-PR-TYPE-05`]
- DO NOT submit a migration PR without the canonical template's rollback evidence [`GIT-PR-TYPE-03`]
- DO NOT submit a feature-flag PR without naming the flag and stating its default state [`GIT-PR-STACK-04`]
- DO NOT submit a UI PR without the canonical template's UI evidence [`GIT-PR-TYPE-01`]
- DO NOT use stack bookmarks that don't follow `<feature-slug>/NN-<scope>`, `<scope>` being any short kebab-case summary [`GIT-PR-STACK-01`]
- DO NOT fix issues by patching a later PR when the bug originates in an earlier unmerged change [`GIT-PR-STACK-02`]
- DO NOT rewrite public history after a stacked PR merges; use a corrective PR instead [`GIT-PR-STACK-03`]
- DO NOT land behaviour changes outside a feature flag unless the change is tiny, isolated, and reversible [`GIT-PR-STACK-04`]
- DO NOT merge stacked PRs out of order or skip rebasing the next PR onto main after the lower lands [`GIT-PR-STACK-05`]
- DO NOT open stacked PRs as ready-for-review; always start in draft [`GIT-PR-STACK-06`]

## Rule Matrix

| Rule ID | Violation | Bad Examples |
|---|---|---|
| `GIT-MSG-01` | Wrong or missing commit type | `update code`; `fixed bug`; `changes` |
| `GIT-MSG-02` | Directory path used as scope | `feat(client/web-talent): add filter`; `fix(service/profile): correct validation` |
| `GIT-MSG-03` | Title exceeds 72 characters | `feat(authentication-service): add comprehensive OAuth2 login support with multiple providers and token refresh` |
| `GIT-MSG-04` | Past tense or non-imperative mood | `fixed bug`; `added feature`; `refactored code` |
| `GIT-MSG-05` | Wrong footer keyword | `Fixes #123`; `Resolves #456` |
| `GIT-MSG-06` | Body line exceeds 72 characters | Long unwrapped paragraphs in commit body |
| `GIT-MSG-07` | Too many comma-separated scopes | `fix(auth,profile,dashboard): update validation` |
| `GIT-BRN-01` | Non-kebab-case branch name | `feat/addFilter`; `fix/user_profile` |
| `GIT-BRN-02` | Branch scope mismatch | `feat/client-web-talent/add-filter` (uses directory path, not package name) |
| `GIT-PR-01` | PR not started as draft | Creating PR directly as ready-for-review |
| `GIT-PR-02` | Canonical PR template violation | PR body missing template-required change evidence |
| `GIT-PR-03` | PR title format incorrect | `Add new feature`; `Fix: bug in auth` |
| `GIT-PR-SIZE-01` | Green-zone definition not respected | (informational — establishes ≤15 files OR ≤500 LOC baseline) |
| `GIT-PR-SIZE-02` | Yellow-zone PR missing template-required evidence | 22 files / 900 LOC PR lacking the canonical template's risk evidence |
| `GIT-PR-SIZE-03` | Red-zone PR without indivisibility rationale | 45 files / 1500 LOC PR with no specific reason it cannot be split |
| `GIT-PR-SIZE-04` | Black-zone evidence or approval gate missing | Publishing an 80-file / 3500-LOC rename without Risk and Test plan evidence; approving it before a qualifying OWNER discussion comment |
| `GIT-PR-TYPE-01` | Missing or ambiguous archetype label | PR with no archetype label, multiple archetype labels, or a label absent from the repository |
| `GIT-PR-TYPE-02` | Spec or scaffolding mixed with implementation | One PR adds `domain/order.ts` types and the `processOrder()` impl |
| `GIT-PR-TYPE-03` | Migration mixed with logic, or missing template evidence | Prisma migration + new business rule in same PR; migration PR lacking rollback evidence |
| `GIT-PR-TYPE-04` | Mechanical refactor mixed with behaviour change | Rename `User` -> `Account` plus a new `suspend()` method in same PR |
| `GIT-PR-TYPE-05` | Generated files mixed with hand-written code without marker | `pnpm-lock.yaml` + lockfile-shaped diffs alongside hand edits, no separator |
| `GIT-PR-STACK-01` | Bookmark naming wrong | `auth-rewrite-spec`; `01_spec`; `feature/auth/spec` |
| `GIT-PR-STACK-02` | Fix applied at the wrong stack level | Adding a defensive null check in PR-03 for a bug introduced in PR-01 (still unmerged) |
| `GIT-PR-STACK-03` | History rewrite after merge | `git push --force` to a branch whose lower PR has already merged |
| `GIT-PR-STACK-04` | Behaviour change without flag, or flag PR missing default state | Switching auth provider in a non-flagged PR; `feature-flag` PR not stating `default: off` |
| `GIT-PR-STACK-05` | Out-of-order merge or missing rebase | Merging PR-03 before PR-02; not rebasing PR-04 onto main after PR-03 lands |
| `GIT-PR-STACK-06` | Stacked PR opened ready-for-review | Stack PR created without `--draft` |
