# Conventional Commits — regex, types, scope, subject, body rules

Single source of truth for commit subject validation. The skill MUST validate against this regex BEFORE any `jj describe` / `git commit` runs. See [SKILL.md](../SKILL.md).

## Regex

```
^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([\w./-]+\))?!?: .+
```

Anchored at start. Required colon-space between header and subject text. Optional `(scope)` and optional `!` for breaking change.

Quick bash check:

```bash
regex='^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([[:alnum:]./_-]+\))?!?: .+'
[[ "$SUBJECT" =~ $regex ]] && echo "OK" || echo "REJECT"
```

## Allowed types

| Type | When to use |
|---|---|
| `build` | Build system, dependency, packaging changes (webpack, rollup, package.json deps) |
| `chore` | Routine maintenance that doesn't fit elsewhere (gitignore, repo hygiene) |
| `ci` | CI/CD pipeline files (GitHub Actions, GitLab CI, Makefile for CI) |
| `docs` | Documentation only (README, JSDoc, comments, MD files) |
| `feat` | New user-facing feature or new public API surface |
| `fix` | Bugfix that corrects incorrect behaviour |
| `perf` | Performance improvement with no behaviour change |
| `refactor` | Code restructure with no behaviour change and no perf claim |
| `revert` | Reverts a previous commit (body must reference the reverted sha) |
| `style` | Formatting / whitespace / lint-only fixes (no logic change) |
| `test` | Test code only (adding, fixing, refactoring tests) |

Reject any type not in this allowlist. No aliases (`feature`, `bugfix`, etc).

## Scope rules

Scope is optional but recommended for monorepo / multi-package projects.

- **Short package name** — e.g. `user-profile`, `auth`, `web`, `service`, `data`.
- **Drop catalog prefixes** — write `auth`, NOT `@scope/auth`; write `web`, NOT `@example/web`.
- **Cross-package concerns** — name the concern, not the package list. e.g. `feat(theming): unify dark mode` across `web` + `react` packages.
- **Repository-specific multi-scope syntax** — use it only when the active
  repository's commit policy explicitly permits it. This repository's
  canonical regex permits one scope, so name a shared concern instead.
- **Global changes** — OMIT the scope entirely. e.g. `chore: bump node to 22`.
- **Kebab-case only**. No spaces, no underscores, no caps.

Examples:

```text
feat(user-profile): add avatar upload
fix(auth): correct token expiry off-by-one
refactor(theming): extract palette resolver
chore: bump node to 22
docs(react): document Server Component contract
test: add integration tests for password reset
```

## Subject rules

- Target ≤50 characters. Hard limit 72.
- Imperative mood ("add", "fix", "rename") — NOT past tense ("added", "fixed").
- NO trailing period.
- NO emoji prefixes. The skill rejects subjects containing emoji codepoints.
- Capitalize the first word naturally (e.g. proper nouns). Lower-case start is conventional but not enforced.
- Subject SHOULD be self-explanatory without reading the body.

Examples — good:

```text
feat(auth): add password reset flow
fix(web): handle empty avatar list
refactor: extract conventional regex into shared util
```

Examples — bad (and why):

```text
feat: Added new feature.            (past tense; trailing period)
fix: 🐛 fix token bug                (emoji; "fix" tautology)
update auth                          (no type; "update" too vague)
feat(@scope/auth): add reset          (catalog prefix in scope)
```

## Breaking change marker

Add `!` immediately before the colon to signal a breaking change:

```text
feat(auth)!: drop deprecated /v1/login endpoint
```

A breaking change MUST be documented in the body under a `BREAKING CHANGE:` footer (Conventional Commits spec).

## Body rules

- Separate from subject by ONE blank line.
- Wrap every body line at 72 characters; this is a hard limit.
- Explain **WHY**, not WHAT. The diff shows what; the body explains the reasoning, trade-offs, alternatives considered.
- Close issues only with `Closes #<number>, #<number>...` at the bottom. Use
  commas for multiple issues; never substitute `Fixes` or `Resolves`.
- Reference non-closing issues or PRs by URL or `#NNN` at the bottom.
- For `revert`, include `Reverts <sha>` line.
- For `BREAKING CHANGE`, include a `BREAKING CHANGE:` paragraph describing migration.

Example:

```text
feat(user-profile): add avatar upload

Adds the AvatarPicker component plus the upload endpoint and avatar
field on the user model so the whole feature lands as one shippable
change. Files in each layer compile in isolation per the
self-containment rule.

Image processing uses sharp instead of jimp because sharp's libvips
backend is ~6x faster on benchmark fixtures.

Closes #482
```

## Enforcement

- The skill applies the regex pre-mutation. Failures STOP the workflow; no silent rewrite.
- `/coding:pr create` reuses this regex for PR title generation.
- Lint hooks may also enforce; this file is the canonical contract.
