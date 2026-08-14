# Coding

General code production: writing, fixing, refactoring, testing, linting,
documenting, and publishing code with history you can trust. Depends on
`essential`. Every workflow follows the state contract — worker
skills return evidence and manifests; the coordinator reconciles state.

## History safety

Two mechanisms make saves and publication safe around AI-driven edits:

- **One `jj` playbook.** [`references/jj.md`](references/jj.md) owns
  initialization, workspaces, stacked-review fixes, history shaping,
  publication handoffs, and recovery for every coding skill.

- **Scoped saves.** Lifecycle saves run through `coding:commit` with a sealed
  path manifest (`--paths-from=<manifest> --manifest-sha256=<sha>`), so a
  save touches exactly the reviewed file set and preserves unrelated staged
  or dirty developer work. Any writer after sealing invalidates the manifest.
- **Per-commit QA.** `coding:finalize-commits` verifies every unpushed commit
  in isolation before `coding:pr create` publishes draft PRs and drives CI to
  green. History mutation belongs to `coding:commit` alone.

## Skills

| Skill | Use when |
| --- | --- |
| `coding:write-code` | New functions, features, modules, or endpoints via a TDD lifecycle. |
| `coding:draft-code` | Typed skeletons with canonical `TODO(implementation)` placeholders. |
| `coding:complete-code` | Completing explicit production stubs and draft sentinels. |
| `coding:complete-test` | Test TODOs, coverage gaps, fixtures, redundancy cleanup. |
| `coding:fix` | Diagnosed failures: broken tests, type errors, lint failures, red CI. |
| `coding:refactor` | Behavior-preserving structural improvement of green code. |
| `coding:modernize` | Version-supported syntax/API upgrades. |
| `coding:lint` | Mechanical standards enforcement over a selected scope. |
| `coding:review-code` | Post-implementation / pre-merge review into canonical review artifacts. |
| `coding:document` | Source-backed package and architecture docs after meaningful changes. |
| `coding:commit` | All history mutation: scoped saves, split/absorb, stacking, reordering. |
| `coding:finalize-commits` | Isolated per-commit QA before publishing a stack. |
| `coding:pr` | Create or update draft PRs, publish external reviews, and merge linear stacks through explicit subcommands. |
| `coding:setup-project` | Project/monorepo scaffolding when structure is missing. |
| `coding:cleanup` | Evidence-based retirement of stale branches, worktrees, and work dirs. |
| `coding:find-unused` | Read-only dead-code discovery. |
| `coding:sync-tool` | Installing/updating registered CLI tools (brew, jj, gh, …). |

`skills/commit/SKILL.md` carries commit, branch, and local-history directions;
the action references under `skills/pr/references/` carry pull-request
directions. `standards/git/` scans rendered PR messages and implementation-diff
size and composition; `skills/pr/templates/message.md` and
`skills/pr/templates/inline-review.md` own their rendered shapes. Other
`standards/` directories carry implementation-scannable policy that `lint`
and reviewers enforce; React and Web route their standards through the same
executors.
