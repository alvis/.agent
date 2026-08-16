---
name: create-agent
description: "Creates a new specialist agent from a shared base prompt plus split metadata, Claude, and Codex JSON sources, proposing intelligence and permissions by role archetype and confirming them with the user before writing. Use when adding a new subagent, defining a new specialist role, scaffolding an agent definition, or when update-agent hands off new-agent creation."
requirements:
  intelligence: high
context: fork
argument-hint: "<role description> [--plugin=<owner>] [--intelligence=...] [--permission=...] [--yes]"
---

# Create Agent

Create `base.md` plus `frontmatter/meta.json`, `claude.json`, and `codex.json`
under `plugins/<owner>/agents/<name>/` for one
genuinely distinct role, with ownership and critical settings confirmed before
anything is written. `update-agent` owns changes to existing definitions.

## Boundaries

- Use for: adding a new specialist subagent, scaffolding an agent definition
  from scratch, or accepting a new-role handoff from `update-agent`.
- Do not use for: modifying an existing agent (`update-agent`), creating
  skills (`write-skill`), or a role an existing agent already covers —
  reject the duplicate and route to `update-agent` instead of authoring a
  competing trigger surface.

## Inputs

- **Required**: a role name or description clear enough to classify into an
  archetype and to write trigger-bearing frontmatter.
- **Optional**: `--plugin=<owner>` pins the plugin that owns the role;
  `--intelligence=...`, `--permission=...` pin that
  setting and skip its confirmation prompt; `--yes` accepts every
  recommendation without prompting.
- **Owner token**: use the plugin's source-directory name under `plugins/`
  (for example, `coding`).
- **Prerequisites**: the [agent template](../../skills/create-agent/templates/agent.md),
  `role-prompt.md` beside it, and the
  [context catalog](../../references/context-catalog.md). Follow
  the [authoring standard](../../standards/authoring/).

## Workflow

1. Read the agent template, `role-prompt.md`, the context catalog, relevant
   team/edge definitions, and neighboring agents; search existing
   descriptions and callers. Reject a duplicate role, unclear outcome,
   invalid name (a role-only lowercase-kebab identifier such as
   `frontend-implementer`), personalized definition name, or missing authoritative template.
2. Select the owning plugin by responsibility and existing trigger surface.
   If `--plugin` is omitted, recommend the closest owner and confirm it with
   the user before the settings confirmation. The owner must be a plugin in
   this repository; do not default all agents to Governance or Essential.
3. Classify the role — producer, critic, or orchestrator; leaf or
   spawn-capable; interactive, workflow-spawned, teammate, or background —
   and derive:
   - positive trigger phrases, near-miss exclusions, owned outcome, and stop
     condition;
   - the exact standards and repo-derived context verbatim from the context
     catalog — invent no standard or path;
   - fixed intelligence level, launch-appropriate `permissionMode`, and memory and
     isolation settings from
     [references/intelligence-level-heuristic.md](references/intelligence-level-heuristic.md)
     — pick the least expensive level that clears the role's bar;
   - no `tools` field, so both leaf-by-charter and coordinating roles inherit
     the complete runtime tool surface;
   - background, maxTurns, skills, MCP, hooks, and collaboration edges only
     when the role needs them. A producer's independent-review posture is
     carried by its charter, its convergence predicate, and Essential's shared
     orchestration policy — never by a per-agent hook.
4. Confirm before writing: compose one battery of at most four questions for the
   graphical or structured user-input tool,
   covering intelligence level and — only when they deviate from
   the archetype default — permissionMode and leaf-vs-spawn posture. List the
   recommended value first marked "(Recommended)" with a free-text override
   as the last option. Flags override their named fields and skip their
   prompts; `--yes` accepts all recommendations. No file is written before
   this gate resolves; record the confirmed settings.
5. Create only the four canonical source files beneath the confirmed owner's
   `agents/<name>/` directory. `frontmatter/meta.json` contains
   exactly `name`, `description`, and `intelligence`; `claude.json` contains
   only Claude-specific fields and requires `initialPrompt`; `codex.json`
   contains only native Codex-specific fields and is `{}` when none apply.
   Every file must be valid JSON. The directory and metadata `name` contain
   only the role. End metadata `description` with exactly three distinct
   preferred short names in the canonical sentence so the main agent can name
   a teammate.
6. Build `initialPrompt` from `role-prompt.md` in 2-4 sentences as a no-task
   first-turn directive: its first move (propose if the role's next work is
   legible from repo state, else greet and state the artifact/brief it needs),
   an explicit wait, then deferred context loading and one role-specific
   guardrail. It must NOT restate identity, announce that no task was given, or
   preload standards, and it must agree with `base.md`.
7. Write `base.md` as the role's own continuous working voice, preserving the
   template's functional sections: role/mission, expertise and operating
   style, communication style, exact base context, coordination loop and stop
   rule, and collaboration/spawn posture. "Voice" means stable role-specific
   instructions, not a disposable persona, personalized identity, or decorative biography.
   Start with one H1 title and do not write an intelligence line; the stitcher
   derives exactly one line beneath the rendered title from `meta.json`.
8. Add or update the task-to-agent routing row in the owning plugin's
   `hooks/ALLAGENT.md`, creating that file if necessary. Keep only this
   agent's owned tasks there; do not rebuild a central roster table.
9. Conduct a paper-only thought experiment and blindspot test over positive
   trigger phrases, near-miss exclusions, collaboration edges, and first-turn
   behavior. If notes are written down, keep them temporary as a Markdown scratch
   document in an OS temp
   folder (for example `${TMPDIR:-/tmp}/check.md`) using
   [check reference](../../references/check.md) as the
   example table format with `:white_check_mark:`/`:x:` status markers,
   and delete them before staging; they are not deliverables and must not be
   committed.
10. Check runtime-tool behavior: every definition omits `tools`; a leaf does not claim it will spawn, and a
   coordinating role follows the shared nested-spawn policy. Use `disallowedTools` only for narrow durable
   restrictions; workflow-spawned and teammate permissions must follow template rules. Also check the
   intelligence level, allowed permission values, valid color values,
   context aliases and paths, namespaced skills, MCP references, hooks,
   memory semantics, initialPrompt/base consistency, explicit triggers, and
   non-overlap with neighbors.
11. Run the verification below; when a check fails, fix the cause and re-run
   that check. Repeat until every check passes or a concrete blocker remains,
   then report the blocker instead of looping.

## Verification

- Parse `frontmatter/meta.json`, `claude.json`, and `codex.json` with
  `uv run --python 3.13 python -m json.tool`.
- Run Essential's deterministic stitch helper twice against the source directory,
  writing only to separate temporary outputs, then inspect both artifacts:
  `uv run --python 3.13 plugins/essential/skills/install-agents/scripts/stitch_agent.py plugins/<owner>/agents/<name> --harness claude --output <temporary-claude-path>`
  and
  `uv run --python 3.13 plugins/essential/skills/install-agents/scripts/stitch_agent.py plugins/<owner>/agents/<name> --harness codex --output <temporary-codex-path>`.
- Check placeholders, the template key allowlist and required keys, referenced
  files/aliases/skills, duplicate seams, prompt contradictions, and the owning
  plugin routing row, point-form role-specific Collaboration section, and
  direct teammate-messaging capability against the runtime capability list.
  Both rendered definitions must contain exactly one intelligence line matching
  `meta.json`. Shared delegation,
  handoff, workflow, and review policy belongs in Essential's `hooks/ALLAGENT.md`, not
  individual agent bodies. Official runtime loading remains "not exercised" unless
  the installed loader was actually run.

## Completion

Report created paths, the confirmed settings and who confirmed them (user,
flags, or `--yes`), archetype, trigger/near-miss examples, context
assignments, thought-experiment and blindspot coverage, validation commands and
results, whether runtime loading was exercised, confirmation that temporary
Markdown thought-experiment notes were deleted before commit, and any unresolved
concern. Completion requires all four files, a
non-overlapping trigger surface, a role-specific voice, and all available
validation passing.
