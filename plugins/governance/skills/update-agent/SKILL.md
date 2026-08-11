---
name: update-agent
description: Update explicitly selected agent definitions to the current split-source template or a stated behavior change while preserving useful role expertise, trigger boundaries, context, collaboration links, and working voice. Use when migrating agents to a template revision, correcting agent configuration, or batch-updating selected agents; require an exact selector and route genuinely new roles to create-agent.
model: opus
context: fork
argument-hint: "<agent path, name, or glob> [--changes=...] [--all]"
---

# Update Agent

Find selected source sets under `plugins/*/agents/<name>/`, then update
their `base.md` and split `frontmatter/{meta,claude,codex}.json` to the current template or a
stated behavior change. `create-agent` owns genuinely new roles.

## Boundaries

- Use for: bounded template migrations and explicit corrections to
  explicitly selected agent definitions.
- Do not use for: creating a new role (`create-agent`), deleting agents,
  "modernizing" role-specific prose into template boilerplate, or changing
  protected fields the request did not authorize.
- An empty selector never means all; intentional repository-wide work
  requires explicit `--all`.

## Inputs

- **Required**: an agent path, name, or glob — or explicit `--all`.
- **Optional**: `--changes=...` describing the requested behavior,
  configuration, or template migration.
- **Owner token**: paths and ownership use the source-directory name under
  `plugins/` (for example, `coding`).
- **Prerequisites**: the [agent template](../../skills/create-agent/templates/agent.md),
  `role-prompt.md` beside it, and the
  [context catalog](../../references/context-catalog.md). Follow
  the [authoring standard](../../standards/authoring/).

## Workflow

1. Search every plugin's `agents/` directory for the selector. Read
   the agent template, `role-prompt.md`, the context catalog, the owning
   plugin's `hooks/ALLAGENT.md`, relevant team edges, every selected source set, and real callers. List exact
   targets before mutation. Reject missing or malformed source sets, ambiguous
   globs, locked/in-use targets, or a request that actually creates a new
   role.
2. Snapshot each target before editing:
   - owned outcome, positive/negative triggers, expertise, role-specific
     working voice, and stop rule;
   - exact standards and repo-derived context, collaboration/spawn edges, and
     skills/MCP/hooks;
   - fixed intelligence level, permissionMode, absence of a tools allowlist, memory, isolation,
     background, maxTurns, and `initialPrompt`;
   - the explicit requested changes and the protected fields not authorized
     to change.
3. Re-evaluate the role classification and launch scenario against
   [../create-agent/references/intelligence-level-heuristic.md](../create-agent/references/intelligence-level-heuristic.md)
   (intelligence level, permissionMode, runtime tool inheritance, memory, and isolation criteria).
   Change those fields only when the requested migration or template requires
   it; report every such change.
4. Reconcile `frontmatter/meta.json`, `claude.json`, and `codex.json` with
   their ownership boundaries. Metadata contains only `name`, `description`,
   and `intelligence`; harness files contain only harness-specific fields.
   Remove obsolete keys only with evidence. Always omit `tools` so runtime-provided capabilities remain visible;
   encode leaf and delegation posture in the role charter and shared orchestration rules. Use
   `disallowedTools` only for narrow durable restrictions on read-mostly roles, never as a general allowlist.
   Drop any leftover review-routing Stop hook: independent review is carried by
   the role's charter and convergence predicate plus Essential's shared
   orchestration policy, so no agent re-enforces it per task.
5. Reconcile `base.md` with the required functional sections while preserving
   expertise and voice: integrate approved changes into the existing prose
   and remove superseded instructions — never append an update log or second
   personality. Keep definition paths, frontmatter names, headings, and identity
   prose role-only; descriptions end with exactly three distinct preferred short
   names for main-agent teammate naming. Correct context aliases against the
   catalog. Keep Collaboration to concise outbound collaborator/delegation bullets,
   referencing each known agent's role-only name and main task. Do not duplicate Essential's shared runtime discovery,
   handoff, workflow proxy, spawn-budget, or independent-review policy.
6. Rewrite `initialPrompt` from `role-prompt.md` whenever the role's first
   move, the artifact/brief it needs, or its guardrail changed. It must remain
   a 2-4 sentence no-task first-turn directive (first move → wait → deferred
   context + guardrail), must not restate identity, announce no task, or
   preload standards, and must agree exactly with `base.md`.
7. Recheck positive and near-miss triggers against neighboring agents and
   real dispatch sites through a paper-only thought experiment and blindspot
   test. If notes are written down, keep them temporary as a Markdown scratch
   document in an OS temp
   folder (for example `${TMPDIR:-/tmp}/check.md`) using
   [check reference](../../references/check.md) as the
   example table format with `:white_check_mark:`/`:x:` status markers,
   and delete them before staging; they are not deliverables and must not be
   committed. Keep the task-to-agent row in the
   owning plugin's `hooks/ALLAGENT.md` aligned with the resulting trigger surface; do
   not create a central routing table or widen role ownership incidentally.
8. Independent targets may be delegated per
   [delegation guidance](../../standards/delegation/) in
   bounded batches — one agent source set per subagent, never exceeding the declared
   task-wide child-spawn budget (default three new children) — but each assignment must name exact source sets and
   protected behavior. Review the integrated diff for cross-agent trigger and
   edge conflicts.
9. Run the verification below; when a check fails, fix the cause and re-run
   that check. Repeat until every check passes or a concrete blocker remains,
   then report the blocker instead of looping.

## Verification

- Run Essential's deterministic stitch helper twice for every selected source set,
  writing only separate temporary outputs, and inspect both generated definitions:
  `uv run --python 3.13 plugins/essential/skills/install-agents/scripts/stitch_agent.py plugins/<owner>/agents/<name> --harness claude --output <temporary-claude-path>`
  and
  `uv run --python 3.13 plugins/essential/skills/install-agents/scripts/stitch_agent.py plugins/<owner>/agents/<name> --harness codex --output <temporary-codex-path>`.
- Always parse all three JSON files with
  `uv run --python 3.13 python -m json.tool`, check for
  placeholders, and validate the key surface, intelligence level,
  permission values, tool/spawn posture, context paths, namespaced skills,
  MCP/hooks, initialPrompt/base consistency, trigger separation, and the owning
  plugin routing row. Do not claim official runtime validation unless the
  installed loader was actually run.

## Completion

Return the selector, targets, preserved role traits, changed fields, trigger
examples, thought-experiment and blindspot coverage, validation evidence,
runtime-loading status, confirmation that temporary Markdown
thought-experiment notes were deleted before commit, and unresolved issues.
Completion requires every selected source set to validate and no unrequested role,
voice, permission, or ownership change.
