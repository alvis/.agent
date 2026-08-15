# Coding workflow

Read this before you write, modify, review, upload, or publish code — committing, pushing, and opening or updating a pull request are covered too — then follow the phase your task is in — Before, While, or After Coding — top to bottom.

## Before Coding

### Decide who does the work

Settle this first, from where the task came:

- **From the user** — do it yourself when the change is small (low expected token spend); delegate it otherwise.
- **From another agent** — do it yourself, unless you are a lead (an orchestrator). A lead advises and delegates rather than implementing; the only work it takes inline is a step it would finish in a handful of tool calls, where dispatching costs more than it isolates.

Before work delegation, read `coding:references/ROUTING.md` and route the work to the specialist whose role fits; read `essential:references/orchestration.md` before you delegate, orchestrate, or review across a team. Hand the delegate the full file paths of every relevant skill, direction, template, and standard file — a subagent starts blind.

### Decide where the work will live

Settle this before editing:

- **Small change** — if the user didn't request a specific location, work in
  place. Follow [the shared `jj` guide](jj.md) for initialization and workspace
  selection; otherwise use the current Git branch.
- **Substantial change** (worth a stacked PR) — follow
  `essential:references/directions/establish-work-stream.md`. It first reuses
  the current suitable work ID, then another suitable open stream, and creates
  a new ID only when neither fits. After the four confirmations, prefer a
  **`jj` workspace** when supported; otherwise offer a fresh **local branch**,
  a **`git worktree`**, or the **current branch**. Use
  `~/.workspaces/<project-root-folder-name>/<work-id>` for an isolated tree;
  never use a provider-specific path such as `.claude/worktrees/`.
  - The work-id names the state directory, the source tree, and the branch: `.state/works/<work-id>`, `~/.workspaces/<project-root-folder-name>/<work-id>`, and branch `<type>/<work-id>` — the type prefixes the branch only, never the id or the state path. Work that stays a single PR uses `<type>/<work-id>` and nothing more, with no numbered child. A stream split into a stack or into sub-tasks becomes two-digit-numbered branches beneath it: `<type>/<work-id>/01-resolver`, `<type>/<work-id>/02-contract`. Work remains identified in messages and records by its Work ID or Task ID, then by PR ID or Git commit SHA when available; an ordinal such as `slice 1` is never an identifier. Either way the stream is resolved from the branch that is checked out; a branch shaped otherwise resolves to nothing and the PM is asked instead.
  - Those two shapes cannot coexist — git stores refs as files, so `<type>/<work-id>` blocks `<type>/<work-id>/01-resolver` and vice versa. A single-PR stream that grows cannot add a numbered branch beside the bare one, so it **renames** the bare branch into the first numbered branch — through the forge's branch rename, which retargets the open PR rather than closing it — and pushes the later numbered branches only after that lands. Full rules live in `essential:references/naming.md`.

### If you're writing it yourself

**Understand what you're changing first.** Before writing or fixing any code, build an understanding of the current implementation and its issues — run this once, by whichever is available: the `get_project_overview` MCP tool, the `ide__getDiagnostics` MCP tool, or the project's own build/type-check command — `npm run build` or `npx tsc --noEmit` for TypeScript, `ty` for Python, `cargo check` for Rust.

**Carry out each action with the skill that matches it.** A skill is a tool you invoke with the Skill tool — it is not an agent. You never delegate work "to" a skill and never pass a skill name as a `subagent_type`; you *use* a skill to do the work yourself or inside a subagent. Each skill documents its applicable directions, templates, and standards internally.

| Action | Skill to invoke |
|--------|-----------------|
| Writing new code | `/coding:write-code` or `/coding:draft-code` |
| Setting up project | `/coding:setup-project` |
| Completing TODOs | `/coding:complete-code` |
| Fixing issues | `/coding:fix` |
| Reviewing code | `/coding:review-code` |
| Linting code | `/coding:lint` |
| Refactoring | `/coding:refactor` |
| Committing | `/coding:commit` |
| Finalizing un-pushed commits (per-commit QA) | `/coding:finalize-commits` |
| Creating tests | `/coding:complete-test` |
| Documenting code | `/coding:document` |
| Authoring, creating, updating, reviewing, or merging PRs | `/coding:pr <author|create|update|review|merge>` |
| Pausing work | `/essential:handover` |
| Resuming work | `/essential:takeover` |
| Finding dead code | `/coding:find-unused` |
| Modernizing syntax | `/coding:modernize` |

### Version-control directions

Before choosing or using `jj`, follow `coding:references/jj.md`. Before
committing, branching, or mutating local history, follow
`coding:skills/commit/SKILL.md`. Before publishing, reviewing, or merging,
follow the selected action under `coding:skills/pr/references/`. Templates own
rendering, while standards own observable violations.

### Implementation standards

Read every file in each applicable standards directory, following its
cross-references. A standard is a mechanically or semantically scannable rule
over the resulting implementation or change artifact; a violation is an issue
that requires a fix. The inventory is exhaustive; select by action and
language.

| Applies to | Standards |
| --- | --- |
| All implementation work | `coding:standards/universal/` |
| Functions, methods, and APIs | `coding:standards/function/` |
| TypeScript and JavaScript | `coding:standards/typescript/` |
| Identifiers and operation names | `coding:standards/naming/` |
| Tests and testable implementation | `coding:standards/testing/` |
| Rendered PR messages and implementation-diff size or composition | `coding:standards/git/` |
| Comments, JSDoc, and technical documentation | `coding:standards/documentation/` |
| Errors, logging, and operational behavior | `coding:standards/observability/` |
| Python | `coding:standards/python/` |
| Rust | `coding:standards/rust/` |
| Semantic review | `coding:standards/code-review/` plus the implementation standards above |
| New or moved files and project setup | `coding:standards/file-structure/` |

## While Coding

Before writing code, apply the code-scoped lean-work ladder, minimum-change
rules, and non-negotiable exceptions in
`essential:references/working-attitude.md`.

### Working practices

- Prefer **READ**, **WRITE**, **UPDATE**, **LS**, **GREP** as your primary editing tools over **BASH**.
- **Prepared scripts** — **[IMPORTANT]** you MUST always use scripts defined in the project config (e.g. `package.json`) over running tools directly via bash; this applies to ALL agents and subagents.
  - **DO**: `npm run lint -- <path>`, `npm run test -- <path>`, `npm run build`
  - **DON'T**: `npx eslint <path>`, `npx jest <path>`, `npx tsc`
  - Fall back to direct tool invocation only when no project script exists for the purpose.
- **Diagnostics per change** — you MUST run the `lsp_get_diagnostics` or `ide__getDiagnostics` MCP tool before and after code changes (skip only if `get_project_overview` has just run).
- **Check documentation** — before using an external library, consult **context7** to confirm the correct import or call signature, and **grep** for real-world GitHub usage.
- **Runtime exploration** — to understand the runtime behaviour of a library or API, write a test file (or add a test case to an existing spec) instead of ad-hoc commands like `node -e "..."` or `npx ts-node -e "..."`. Test files are version-controlled, repeatable, and serve as living documentation.

Follow every applicable standard listed above in full.

## After Coding

Completed code goes through a **fix loop** before it is saved — any failing gate returns to implementation:

```
edit code → verify delivery → (fail ⇒ back to code) → lint → (fail ⇒ back to code) → commit
```

Every applicable mechanical gate — lint, type diagnostics, focused tests, and the cross-project consumer build below — runs on every completed change, whatever its size; applicable means the gate's own trigger fired, so the consumer build runs only for a change to a public export. What the change's size decides is only whether the work is *dispatched to another agent* or done in place.

### Gate before the loop

**[IMPORTANT]** After modifying any publicly exported function or class, find every consumer project in the monorepo and run its own build command in that project's root — `npm run build`, `cargo build`, or whatever that project configures. Cross-project breakage is invisible from the changed project alone; the loop's own lint and type stages cover the rest.

### 1. Verify delivery first

Confirm every requirement was actually delivered — if a plan was executed, open the plan file and walk each task, confirming code/tests/docs match; otherwise verify the task's stated requirements. If any task is unmet, return to implementation, fix it, and restart the loop here.

Who verifies is sized on the same test as "Decide who does the work" above:

- **Small, non-consequential change with no review requested** — verify it yourself against the standards `coding:review-code` applies, then continue. Do not spawn a subagent to re-read a small edit you just made. Size alone never qualifies a change here: a one-line authorization, migration, or data-loss fix is consequential and takes the branch below.
- **Consequential change, an explicit request for review, or PR finalization** — dispatch an independent review **subagent**; publishing a pull request is such a gate. For large changes, dispatch a **review coordinator** that fans out sub-review agents per area and consolidates their findings. Have the reviewer invoke the `coding:review-code` skill with the Skill tool — **skills and agent types are separate namespaces; never pass a skill name as a `subagent_type`.**

### 2. Then the mechanical gates

Lint runs on every completed change: invoke the `coding:lint` skill on the touched source files — `.ts/.tsx/.js/.jsx/.py/.go/.rs/.rb/.java/.kt/.swift/.c/.cpp/.h/.hpp/.cs/.php/.sh/.vue/.svelte/.astro` and similar. Skip text/content files (`.md/.mdx/.json/.yaml/.toml/.html/.svg/.csv`) and throwaway scripts that won't be committed. Invoke it yourself for a small change; hand the invocation to a lint subagent (or a lint sub-team for large changes) when the scope is large or its output would be noisy. Either way `coding:lint` runs its own scan-and-aggregate cycle internally — never lint by hand in its place. If lint reports any violation, return to implementation, fix it, then re-run verification and lint.

Type diagnostics and focused tests are separate gates that `coding:lint` does not stand in for — a clean lint pass reports nothing about either, and a change needing no lint repair would otherwise reach the commit decision unchecked. Run both under the changed project's root, resolving the commands from that project before running anything: the `lsp_get_diagnostics` or `ide__getDiagnostics` MCP tool covers types in any language, and otherwise the project's own configured script wins per **Prepared scripts** above. Only when neither exists, fall back to the type checker and test runner its language standard mandates — `tsc --noEmit` and the project's test script for TypeScript, `ty` and `pytest` for Python, `cargo clippy` and `cargo nextest run` for Rust. Never run an `npm` command in a project that has no `package.json`. Proceed only once verification, lint, types, and the tests covering the change are all clean.

### 3. Then commit

- Follow [the shared `jj` guide](jj.md) for initialization, functional
  colocation proof, workspace selection, stacked-review repair, and rollback.
- Saving changes goes through `coding:commit`, which owns every explicit local
  history operation for both `jj` and Git. PR publication and CI convergence
  go through `coding:pr create|update`; never hand-run their mutations outside
  those owners.
- **If the user did not explicitly request a commit, ask whether to commit the work** (via `coding:commit`).
- **If HEAD is not the local main branch, or the work is in a `jj` workspace or
  linked Git worktree, `AskUserQuestion`** whether to open a PR or move the work
  onto local main. The shared guide owns the distinction between those
  workspace types.

### Pull requests

Creating or updating a pull request MUST go through `coding:pr create` or
`coding:pr update`, not a hand-rolled `git`/`gh` sequence. The selected
subcommand composes the conventional-commit title and unified body from the
commit, publishes it, and drives CI to green. This applies even when the request
looks like a small, one-off PR.

The `pr` skill detects the repository mode through the functional proof in
[the shared `jj` guide](jj.md). It publishes the selected bookmark or branch,
uses the authored title and body verbatim, and ends with a draft PR on the
intended base and CI green or its documented absence confirmed.
