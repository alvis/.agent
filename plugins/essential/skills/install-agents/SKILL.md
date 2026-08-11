---
name: install-agents
description: "Discover, validate, stitch, and install specialist agent templates contributed by Essential, its marketplace, and explicitly trusted enabled marketplaces. Use when asked to install agents, set up subagents, refresh the agent team, or configure Claude Code or Codex on a new machine."
---

# Install Agents

Installs agent templates contributed by Essential, the other enabled plugins in
its marketplace, and any enabled marketplace named explicitly with
`--include-marketplace`. The same authoritative template becomes a Claude Code
Markdown definition under `~/.claude/agents/` or a Codex TOML definition under
`~/.codex/agents/`.

## What the installer does

`scripts/install-agents.sh` is idempotent and safe to re-run:

1. In a source checkout, discovers `plugins/*/agents/*`; from an installed Essential plugin, reads the current harness's plugin list and discovers templates from enabled plugins in Essential's marketplace plus explicitly included marketplaces. Codex plugin IDs and versions resolve beneath the loaded Essential cache root; marketplace source paths are never treated as installed roots.
2. Validates every `base.md` plus `frontmatter/meta.json`, `claude.json`, and `codex.json` source set, including its role-only definition name, three distinct preferred short teammate names, runtime tool inheritance, intelligence, field ownership, centralized-policy boundary, and required project-memory path and maintenance contract, and rejects malformed or duplicate names before touching the destination. Installed mode translates recognized legacy single-file intelligence or model/effort projections from lagging sibling-plugin caches; source checkouts require the split schema.
3. Stitches all definitions into Claude Code Markdown or native Codex TOML. Shared `name`, `description`, and `intelligence` come only from `meta.json`; harness overlays contribute only harness-specific fields. `intelligence` is projected through the authoritative [intelligence matrix](references/intelligence-levels.json), which owns both harnesses' model and effort fields. Codex `nickname_candidates` are derived from the three validated preferred names in `description`. Neither `intelligence` nor the retired `intelligenceLevel` key is emitted.
4. Copies staged definitions into the selected harness's agent directory and regenerates shared lead support under `.essential/`, overwriting discovered same-named agents while leaving unrelated and formerly managed files untouched.
5. Prints each installed path and a final count.

Codex has no safe equivalent for Claude's color, permission mode, project-memory mode, worktree isolation, turn limit, startup prompt, or per-agent hooks, so the projection omits them. The Codex projection removes Claude-managed `Memory`, the Dynamic Workflow portion of `Delegation Modes`, and residual worktree or Workflow-launch promises elsewhere while retaining direct persistent delegation. Model tools, sandboxing, approvals, and local memories remain Codex-owned. Codex overlay fields must use scalar TOML-compatible values.

## Workflow

### Step 1: Run the installer

Run the command for the active harness:

```bash
# Claude Code
bash "${CLAUDE_PLUGIN_ROOT}/skills/install-agents/scripts/install-agents.sh" \
  --harness claude

# Codex
bash "<absolute directory containing this loaded SKILL.md>/scripts/install-agents.sh" \
  --harness codex
```

Add repeatable `--include-marketplace <name>` arguments only for enabled
marketplaces the user explicitly trusts. Use the exact configured marketplace
name; this repository does not require an external marketplace.

For Codex, replace the placeholder with the directory from the loaded
`essential:install-agents` skill resource path exposed by the runtime; ordinary shell
calls do not receive a plugin-root environment variable. Codex does not currently
ingest custom agents directly from a plugin. This install step uses its supported
personal-agent directory; start a fresh session afterward so Codex loads the new TOML
definitions.

### Step 2: Verify

Smoke-check one representative definition after confirming the installer's reported count:

```bash
# Claude Code
head -3 ~/.claude/agents/tech-lead.md

# Codex
head -3 "${CODEX_HOME:-$HOME/.codex}/agents/tech-lead.toml"
```

In a fresh session, the roster appears in the selected harness's agent list. For Codex, confirm representative generated `model` and `model_reasoning_effort` values match the matrix rows selected by those agents' `frontmatter/meta.json` intelligence values.

For maintainer verification, run the deterministic contract suite:

```bash
uvx pytest plugins/essential/tests/test_install_agents.py
```

To inspect one stitched source definition directly, select either harness:

```bash
uv run --python 3.13 plugins/essential/skills/install-agents/scripts/stitch_agent.py \
  plugins/coding/agents/tech-lead --harness claude
uv run --python 3.13 plugins/essential/skills/install-agents/scripts/stitch_agent.py \
  plugins/coding/agents/tech-lead --harness codex
```

The stitcher resolves Essential from normal source-checkout and installed-cache
layouts. For another layout, pass `--essential-root <plugin-root>`; it fails
rather than emitting an unresolved `@essential` reference.

### Step 3: Report

Tell the user:

- How many agents were installed and the selected destination
- That they take effect in the next session (the current session's agent list is fixed at startup)
- That re-running overwrites currently discovered agents and does not prune any other files
