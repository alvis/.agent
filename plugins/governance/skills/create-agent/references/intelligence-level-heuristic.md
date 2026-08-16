# Intelligence-Level Heuristic

Shared decision guide for `create-agent` and `update-agent`. Agent metadata owns
one `intelligence` value in `frontmatter/meta.json`. Read the
`essential:install-agents` mapping at
`plugin:essential/install-agents/references/intelligence-levels.json`; its `rank`
orders the levels, `best_for` gives task examples, and harness projections
derive native agent configuration. Pick the lowest ranked level whose examples
clear the role's bar. Use `inherit` only when the active harness must resolve
the agent before skill ownership.

## Other settings

- `permissionMode`: use `auto` for leads, orchestrators, and unattended deep-reasoning or automation producers; `acceptEdits` for scoped edit producers; `default` for critics. Agents launched through ephemeral parallel execution always use `acceptEdits`; teammates inherit the lead's mode.
- Tools: omit `tools` so the agent inherits runtime capabilities. A leaf's no-spawn posture is behavioral.
- Memory: use project memory only when the role self-curates durable repository knowledge.
- Isolation: use `worktree` only when an agent must not race the main working copy.
