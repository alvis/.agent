---
name: pr
description: 'Use for GitHub pull-request workflows when the user asks to draft PR text, verify exact local CI parity, resolve a bare PR or stack number, publish a branch, create, update, discover, check out, review, or merge a PR or linear stack. Trigger before running gh pr, inspecting GitHub stacks, or publishing PR-related changes.'
requirements:
  intelligence: high
argument-hint: "<resolve|checkout|author|verify|create|update|review|stack|merge> [arguments]"
---

# Pull Requests

Before any `jj` decision or command, follow
`coding:references/jj.md`. Its stacked-review repair
route precedes `coding:pr update` publication.

Before any script call, set `CODING_PR_SKILL_DIR` to the absolute directory
containing this loaded `SKILL.md`. This works in both harnesses; ordinary Codex
shell calls do not receive a plugin-root environment variable.

Route every remote pull-request operation through one explicit subcommand. Local
history mutation remains owned by `coding:commit`; local pre-commit review remains
owned by `coding:review-code`.

Each action reference owns its directions. Scan each implementation diff and
rendered PR body against `coding:standards/git/`. Author PR bodies through
[templates/message.md](templates/message.md), then validate them with
[scripts/scan-pr-message.py](scripts/scan-pr-message.py). Render anchored
review comments through [templates/inline-review.md](templates/inline-review.md)
and the overall verdict through
[templates/overall-review.md](templates/overall-review.md).

## Usage

```text
/coding:pr resolve <number-or-pr-url> [--prefer stack|pr]
/coding:pr checkout <number-or-pr-url-or-local-branch> [--prefer stack|pr]
/coding:pr author [<commit-ref>] [--base <ref>]
/coding:pr verify --target <revision-anchor> --base <revision-anchor> [--kind standalone|stack-tip]
/coding:pr create [<commit-ref>] [--branch-prefix <name>] [--remote <name>] [--no-verify] [--no-review] [--max-iteration <count>] [--publish-only] [--dry-run]
/coding:pr update [<pr-number-or-url> | <commit-ref>] [--branch-prefix <name>] [--remote <name>] [--no-verify] [--no-review] [--max-iteration <count>] [--publish-only] [--dry-run]
/coding:pr review [<pr-number-or-url> | <source-tree-path>] [--repo <owner/name>] [--area=<list>] [--dry-run]
/coding:pr stack list
/coding:pr stack checkout <stack-number-or-pr-number-or-pr-url-or-local-branch>
/coding:pr merge <pr numbers...> [--method=rebase|squash|merge] [--remote <name>] [--destination <branch>] [--force]
```

When the request omits a subcommand, names no clear action, or could select more
than one action, print the complete usage block above and stop. Do not infer a
remote mutation.

## Routing

PR numbers and stack numbers are separate sequences, so a bare number can name
both. Before `resolve`, `checkout`, `update`, `review`, `merge`, or a `stack`
selector acts on a number or URL, bind its namespace through
[references/resolve-reference.md](references/resolve-reference.md), which orders
the two lookups by the request's own wording. Never report a number as
unlocatable from one namespace's lookup alone.

For every request to create, inspect, update, restructure, publish, check out,
sync, navigate, unstack, or merge a GitHub PR stack, load
[references/github-stacks.md](references/github-stacks.md) before selecting an
operator. This applies even when the request arrives through `create`, `update`,
or `merge`, rather than the explicit `stack` route.

- `resolve` reports which namespace a number or URL names, and mutates nothing.
  Follow [references/resolve-reference.md](references/resolve-reference.md) and
  report the resolved surface, the rejected candidate, and any ambiguity.
- `checkout` lands a resolved stack or PR in a `jj` workspace. Follow
  [Land the resolved surface](references/resolve-reference.md#land-the-resolved-surface),
  which fetches the resolved head and adds a workspace on it, leaving every
  existing workspace untouched. It never commits, rewrites, pushes, or
  publishes.
- `author` writes deterministic PR title and body text without publication,
  using [templates/message.md](templates/message.md) when the repository has no
  local template.
  Follow only [Author the PR text](references/create-update.md#author-the-pr-text);
  `--base` selects the intended PR base instead of the first-parent default.
- `verify` runs the fail-closed local test/lint gate for one exact target and
  base without publishing. Load and follow
  [references/verify-ci-parity.md](references/verify-ci-parity.md); callers must
  pass resolved immutable revision IDs, and `--kind` defaults to `standalone`. Because these
  inputs do not identify a base ref or event type, workflow applicability is
  conservative and the receipt records that mode.
- `create` opens new draft PRs for one saved change or a conventional linear
  stack. Load and follow
  [references/create-update.md](references/create-update.md) with
  `ACTION=create`, including its default tip-first and bottom-up local
  verification gate, and always load
  [references/stacked-prs.md](references/stacked-prs.md).
- `update` republishes existing PR heads for a conventional linear stack,
  refreshes their title, body, and bases, and drives CI to green. Load and follow
  [references/create-update.md](references/create-update.md) with
  `ACTION=update`, including its default tip-first and bottom-up local
  verification gate, and always load
  [references/stacked-prs.md](references/stacked-prs.md).
- `review` publishes one external review per PR, or one holistic review unit for
  a linear stack with findings attributed to its PR surfaces. As the
  context-owning caller,
  load [references/review-workflow.md](references/review-workflow.md), provision
  any owned tree, and retain its cleanup lease. Run the read-only steps in a
  fresh `code-quality-critic` subagent with no inherited implementation context,
  close the lease after any return or cancellation, and never delegate again
  from that dedicated reviewer. A fresh critic dispatched by
  [references/review-loop.md](references/review-loop.md) with an explicit
  preprovisioned stack capsule is already that dedicated reviewer: it runs the
  review phase directly instead of nesting another dispatch.
- `stack` follows
  [references/github-stacks.md](references/github-stacks.md#list-and-land):
  - `list` lists the current repository's GitHub PR stacks.
  - `checkout <stack-number-or-pr-number-or-pr-url-or-local-branch>` lands one
    explicitly selected stack, after namespace resolution, in a `jj` workspace
    at its top member's head. It may fetch, but it does not own commits,
    history rewriting, pushes, or PR publication.
- `merge` validates and merges a conventional linear stack bottom-up. For a
  GitHub PR stack, use the GitHub operator map loaded above instead. Otherwise
  load and follow
  [references/stacked-prs.md](references/stacked-prs.md), then
  [references/merge.md](references/merge.md).

<IMPORTANT>
Execute exactly one subcommand per invocation. A workflow may instruct a later
`coding:pr` invocation, but it must name that subcommand explicitly. Reject an
option absent from the usage contract and stop before any remote mutation.
</IMPORTANT>
