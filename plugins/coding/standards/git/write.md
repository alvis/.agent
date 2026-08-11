# Git Workflow: Compliant Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.
> **Compliance**: Also follow `scan.md` in this directory to avoid violations during writing. When unsure about a specific rule, consult its detailed guidance in `rules/<rule-id>.md`.

## Key Principles

- Use Conventional Commits format: `<type>(<scope>): <summary>`
- Scope = short package name — drop the catalog prefix (`@theriety/`, `@amino/`)
- Title: aim for ≤50 characters, up to 72 for clarity, 72 hard limit; present-tense imperative mood
- Body: wrap at 72 characters, keep short but descriptive
- Footer: `Closes #<issue-number>, #<issue-number>...` (use commas, not `Fixes`)
- Branch format: `<type>/(<scope>)/<topic>` in lowercase-kebab-case
- Always start PRs as drafts; author bodies through the canonical PR template

## Core Rules Summary

### Commit Message (GIT-MSG)

- **GIT-MSG-01**: Always prefix commits with a valid type (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`).
- **GIT-MSG-02**: Use the short package name as scope — drop the catalog prefix; use concern name for cross-package changes; omit scope for global changes.
- **GIT-MSG-03**: Try to limit title to 50 characters; if longer title offers better clarity, use up to 72 characters; hard limit is 72.
- **GIT-MSG-04**: Use present-tense, imperative mood (`add`, `fix`, `refactor` — not `added`, `fixed`, `refactored`).
- **GIT-MSG-05**: Mention closed issues with `Closes #<issue-number>, #<issue-number>...` (use commas, not `Fixes`).
- **GIT-MSG-06**: Wrap body text at 72 characters; keep it short but descriptive.
- **GIT-MSG-07**: Comma-separated scopes are acceptable when touching exactly two packages.

### Branch Naming (GIT-BRN)

- **GIT-BRN-01**: Use lowercase letters and hyphens only; avoid underscores or camelCase.
- **GIT-BRN-02**: Use the same scope convention as commit messages (short package name, concern, or catalog).

### Pull Request (GIT-PR)

- **GIT-PR-01**: Always start with a draft PR and update it as the code evolves.
- **GIT-PR-02**: Follow the canonical PR template for body content and conditional evidence.
- **GIT-PR-03**: PR title follows the same format as commit messages.

## Patterns

### Commit Types

| Type | Description |
|---|---|
| `feat` | Introduces a new feature |
| `fix` | Fixes a bug (including dependency upgrades for bug fixes) |
| `docs` | Documentation updates |
| `style` | Code formatting, white-space, etc. (no functionality change) |
| `refactor` | Code changes that neither fix a bug nor add a feature |
| `perf` | Performance improvements |
| `test` | Adding or fixing tests |
| `build` | Changes affecting the build system (e.g., `webpack`, `docker`) |
| `ci` | Changes to CI configuration and scripts |
| `chore` | Routine tasks like upgrading dependencies that don't affect production code |
| `revert` | Reverts a previous commit |

### Scope Convention

Use the **short package name** as scope — drop the catalog prefix (e.g., `@theriety/`, `@amino/`). Scopes should be short and scannable in `git log`.

| Scenario | Scope Rule | Example |
|---|---|---|
| Single package | Short package name | `ai`, `gateway-microservice`, `hmr`, `authentication` |
| Multiple packages, shared concern | Name the concern | `local-stack`, `a11y`, `signals` |
| Whole catalog or infra | Catalog or infra name | `theriety`, `pulumi`, `github-actions` |
| Truly global | Omit scope entirely | _(no scope)_ |
| Name collision across catalogs | Prefix with short catalog name | `amino-auth` vs `theriety-auth` |

Comma-separated scopes are acceptable when touching exactly two packages:

- ✅ `fix(gateway,hmr): resolve port conflict in local dev server`

### Commit Title Examples

- ✅ `feat(ai): add structured extraction pipeline`
- ✅ `fix(client-desktop): correct StableSnapshot diff serialization`
- ✅ `refactor(gateway): extract shared middleware into dispatch module`
- ✅ `refactor(local-stack): align LocalGatewayConfig across development and theriety` _(cross-package, shared concern)_
- ✅ `build(theriety): update shared tsconfig base` _(catalog-level)_
- ✅ `chore: update TypeScript to 5.7 across all packages` _(global, no scope)_
- ✅ `fix(auth): allow login with email alias`
- ✅ `fix(profile, auth): stop access when role is missing (#123, #789)`
- ❌ `fix(profile, auth): stop access (#123, #789)` _(title too vague)_

### Commit Structure

```plaintext
<type>(<scope>): <summary>

<body>

<footer>
```

**Title**: Present-tense, imperative mood. Reference issue or PR numbers if helpful.

**Body**: Wrap at 72 characters. Keep it short but descriptive. If the change requires more detail, add a body or BREAKING CHANGE section.

**Footer**: `Closes #<issue-number>, #<issue-number>...`

### Branch Naming

Format: `<type>/(<scope>)/<topic>`

Use the same scope convention as commit messages (short package name, concern, or catalog).

An engineering work stream is the one exception, and its branch shape is owned by `naming.md` in the essential plugin's `references/` directory rather than defined here. What this rule adds is how to read it: the middle segment is the stream's identity, not a package scope, so it never has to match the commit scope — `feat/work-id-naming/01-resolver` is correct for commits scoped `essential`. See also `GIT-PR-STACK-01`.

| Scenario | Example |
|---|---|
| Single package | `feat/ai/add-extraction-pipeline` |
| Single package (different catalog) | `fix/client-desktop/stable-snapshot-diff` |
| Cross-package concern | `refactor/local-stack/align-gateway-config` |
| Catalog-level | `build/theriety/update-shared-tsconfig` |
| Infra | `ci/github-actions/add-pnpm-cache` |
| Global (no scope) | `chore/update-typescript` |

Rules:

- Use lowercase letters and hyphens to separate words
- Avoid using underscores or camelCase
- Keep branch names descriptive but concise
- Include scope when relevant
- Delete branches after merge

### Pull Request Template

Always start with a draft PR and update it as the code evolves.

**PR Title**: Use the same format as commit messages:

- `feat(api): add support for user analytics export`

Use the canonical bundled template at
[`../../skills/pr/templates/pr.md`](../../skills/pr/templates/pr.md).
It is the sole owner of PR-body structure, conditional sections, rendering
guidance, and body examples. This standard owns review and publication policy.

### PR Review Checklist

#### For Authors

Before requesting review:

- [ ] **Tests**: All tests pass locally
- [ ] **Lint**: No linting errors or warnings
- [ ] **Types**: TypeScript compilation succeeds
- [ ] **Coverage**: Test coverage maintained or improved
- [ ] **Documentation**: Updated relevant docs
- [ ] **Commits**: Clean commit history (squash if needed)
- [ ] **Size**: PR is focused and not too large
- [ ] **Description**: Clear PR description with context

#### For Reviewers

When reviewing PRs:

- [ ] **Functionality**: Does the code do what it claims?
- [ ] **Tests**: Are tests comprehensive and meaningful?
- [ ] **Code Quality**: Is the code clean and maintainable?
- [ ] **Performance**: No obvious performance issues?
- [ ] **Security**: No security vulnerabilities?
- [ ] **Architecture**: Follows project patterns?
- [ ] **Documentation**: Is the code self-documenting or commented?
- [ ] **Edge Cases**: Are edge cases handled?

### PR Size Zones

A precise zone policy supersedes the loose Small/Medium/Large bands above when
an enforced lint or stacked-PR workflow is configured. A PR's zone is the
**stricter** of all files changed and authored net LOC.

The numeric table is a human-readable projection of
`../../skills/pr/assets/size-thresholds.json`, the sole threshold authority.
Contract verification checks every projected value against that asset.

| Zone   | Files Changed | Authored Net LOC | Reviewer Expectation              |
|--------|---------------|---------|------------------------------------|
| Green  | ≤ 15          | ≤ 500   | Quick read; default-mergeable      |
| Yellow | ≤ 30          | ≤ 1200  | One reviewer                       |
| Red    | ≤ 60          | ≤ 2000  | Two reviewers; indivisibility rationale |
| Black  | > 60          | > 2000  | Split by default                   |

Count every changed path for the file threshold, including generated,
vendored, and binary files. For the LOC threshold, subtract generated-file
additions and deletions before taking the absolute net of authored additions
minus authored deletions. A path is generated only when its basename is a
package-manager lockfile recognized by
`skills/pr/scripts/classify-pr-size.py`, or `linguist-generated` is `set` or
`true` for that path at the base or head revision. Binary files contribute
zero LOC but remain in the file count. Run that classifier for every PR
surface; do not reproduce its path rules or arithmetic elsewhere. The
classifier evaluates committed objects in an isolated Git directory, so local
`info/attributes`, global/system attributes, external diff hooks, and ambient
diff configuration cannot change a fixed base/head result.

Black-zone PRs produce the single concise finding defined by
`GIT-PR-SIZE-04`. They remain black. A genuinely self-contained unit may be
published as a draft and tested without prior authorization after its canonical
body supplies specific Risk, Test plan, and Why this size evidence. Review
approval requires an OWNER-authored PR discussion comment that explicitly
authorizes the one-off, explains why this exact surface is indivisible, and
names its exact full head and base OIDs. Tooling verifies the live comment
immediately before `APPROVE` but never authors it; either OID changing
invalidates it. Semantic review consumes only the helper receipt's live
`authorization_body` and `rationale`; an earlier fetched comment or body cannot
authorize approval. The five-line contract's rationale is
`Indivisibility: <atomic subject> because <coupling>; otherwise <consequence>`;
review blocks generic or tautological claims even when their structure passes.

### PR Categories (the 12 Archetypes)

Classify every PR with one archetype from `GIT-PR-TYPE-01` and attach its
existing GitHub label when the repository provides it. Before submission,
enumerate repository labels read-only; if the selected label is unavailable,
submit without it and report the skipped label. The label is absent from the
title and body. Never create or silently substitute labels.

- **rfc** — A proposal-only PR adding a design document or decision record. No production code. Use when a change needs alignment before implementation. Lands as the top of a stack so reviewers can comment on intent before reviewing scaffolding.
- **code-spec** — Types, interfaces, schema definitions, and JSDoc-only contracts with no runtime behaviour. Use to lock the shape of an API or domain model before any implementation. Lands first in the stack so downstream PRs reference settled types.
- **contract** — External-facing API, IPC, or wire-format contracts (OpenAPI, GraphQL SDL, protobuf, JSON Schema). Use when the change is observable across services or processes. Reviewed by both producer and consumer owners.
- **domain-model** — Pure domain entities, value objects, and invariants with their unit tests. Use when introducing or reshaping the ubiquitous-language layer. No I/O, no transport, no framework code.
- **implementation** — Business logic that fulfils a previously-landed code-spec or domain-model. Use for the bulk of feature work. Should not introduce new public types — those land in code-spec first.
- **integration** — Wiring between modules, adapters, dependency-injection bindings, and end-to-end tests. Use when connecting already-implemented pieces; expect cross-cutting touch but isolated semantics.
- **feature-flag** — Adds, flips, or removes a feature flag. Use to introduce reversibility before a behaviour change lands, and again to clean up the flag once a rollout settles.
- **migration** — Database schema migrations, data backfills, or config-format upgrades. Isolated from logic changes (`GIT-PR-TYPE-03`). Land behind a flag whenever the migration is observable.
- **ui** — User-facing visual or interaction changes. Use for component, layout, copy, or styling work.
- **mechanical-refactor** — Renames, file moves, automated codemods, and pure restructuring. Isolated from behaviour changes (`GIT-PR-TYPE-04`) so reviewers can trust the diff is mechanical. Often large in LOC but low in cognitive load — qualifies for red-zone justification.
- **cleanup** — Dead-code removal, deprecated-API deletion, lint-debt repayment. Use when the change reduces surface area without altering behaviour. Pairs naturally with a preceding `feature-flag` retirement.
- **observability** — Logs, metrics, traces, dashboards, alerts, and instrumentation. Use when adding visibility without changing behaviour. Reviewed for cardinality, PII, and alert-noise risk.

### Stacked PR Mechanics

When a feature spans more than one zone or category, split it into a stack governed by `GIT-PR-STACK-*`:

- Require every slice to be independently valid. A backward-compatible contract,
  schema, migration, configuration, or feature flag may land as a prerequisite;
  a dangling update may not. If splitting would break integrity or scatter one
  atomic or mechanical operation, keep one PR and justify its actual size zone.
- Bookmark each PR `<feature-slug>/NN-<scope>` (e.g. `auth-rewrite/01-spec`, `auth-rewrite/02-impl`), `<scope>` being any short kebab-case summary of the slice rather than a PR category — see `GIT-PR-STACK-01`.
- Fix issues in the earliest owning unmerged change — `jj edit` / `jj absorb`, or `git rebase --interactive --autosquash` onto the owning commit — never by patching a later PR (`GIT-PR-STACK-02`).
- Once a stack PR has merged upstream, never rewrite history — open a corrective PR instead (`GIT-PR-STACK-03`).
- Land behaviour changes behind a flag unless the change is tiny, isolated, and reversible (`GIT-PR-STACK-04`).
- Merge bottom-to-top; rebase the next PR onto main after each lower PR lands (`GIT-PR-STACK-05`).
- Always open stacked PRs in draft (`GIT-PR-STACK-06`, reinforcing `GIT-PR-01`).

### PR Review Etiquette

#### For Authors

- Respond to all comments
- Mark resolved conversations
- Explain any non-obvious decisions
- Be receptive to feedback
- Update PR based on feedback promptly

#### For Reviewers

- Be constructive and specific
- Suggest improvements, not just problems
- Acknowledge good code
- Focus on important issues first
- Mark every comment per
  [pr/references/review-tone.md](../../skills/pr/references/review-tone.md),
  which owns the marker set and how each one is rendered — never a literal prefix

### Merge Requirements

Before merging:

1. **Approvals**: Required number of approvals received
2. **CI/CD**: All checks pass
3. **Conflicts**: No merge conflicts
4. **Comments**: All review comments addressed
5. **Tests**: New tests for new functionality
6. **Documentation**: Updated if needed
7. **Changelog**: Updated if user-facing changes

### Special PR Types

#### Hotfix PRs

For critical production fixes:

- Title uses the applicable Conventional Commit type, usually `fix:`
- Minimal changes only
- Must include tests
- Fast-track review process
- Deploy immediately after merge

#### Breaking Change PRs

For backwards-incompatible changes:

- Title uses `type(scope)!:`; the commit body uses a `BREAKING CHANGE:` footer
- Migration guide required
- Major version bump needed
- Extended review period
- Coordinate with dependent teams

#### Documentation PRs

For documentation-only changes:

- Title starts with `docs:`
- Can skip certain CI checks
- Still requires review
- Update relevant indexes

## Anti-Patterns

- Using directory paths as scope (`feat(client/web-talent)`) instead of short package names (`feat(web-talent)`).
- Vague commit messages without type prefix (`fixed bug`, `update code`, `changes`, `WIP`).
- Using past tense (`added`, `fixed`) instead of imperative mood (`add`, `fix`).
- Using `Fixes` or `Resolves` in footer instead of `Closes`.
- Exceeding 72-character hard limit on commit titles.
- More than 2 comma-separated scopes in a single commit.
- Creating PRs directly as ready-for-review instead of starting as draft.
- Publishing a PR body that violates the canonical PR template.

## Quick Decision Tree

1. Writing a commit? Choose type first (`GIT-MSG-01`), then determine scope using package name convention (`GIT-MSG-02`).
2. Choosing scope? Single package = short name; cross-package = concern name; catalog-level = catalog name; global = no scope (`GIT-MSG-02`).
3. Title too long? Aim for ≤50 chars; accept up to 72 for clarity; never exceed 72 (`GIT-MSG-03`).
4. Closing issues? Use `Closes #123, #456` in footer, never `Fixes` (`GIT-MSG-05`).
5. Creating a branch? Use `<type>/(<scope>)/<topic>`, same scope as commits, lowercase-kebab-case (`GIT-BRN-01`, `GIT-BRN-02`).
6. Opening a PR? Start as draft, use the canonical body template, and format the title as a commit (`GIT-PR-01`, `GIT-PR-02`, `GIT-PR-03`).
