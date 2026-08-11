# Governance

The meta-layer: creating and maintaining the Claude Code configuration this
marketplace is made of — agents, skills, and standards — with validation
before anything ships. Depends on `essential`. Routes to two agents:
`harness-eval-engineer` (eval harnesses, benchmarks, feasibility prototypes)
and `workflow-optimizer` (meta-review of agents, skills, and collaboration
patterns).

## Skills

| Skill | Use when |
| --- | --- |
| `governance:write-skill` | Creating, updating, or verifying a reusable skill with clear ownership, portable resources, and trigger checks. |
| `governance:create-agent` | Scaffolding a new specialist agent from `base.md` plus split metadata, Claude, and Codex JSON sources. |
| `governance:update-agent` | Migrating selected agents to the current template or a stated behavior change. |
| `governance:create-standard` | Establishing a new standard (meta/scan/write + per-rule guides) under a plugin's `standards/`. |
| `governance:update-standard` | Scoped rule changes and template migrations for existing standards. |

`standards/` holds authoring and delegation policy, `references/` holds the
context catalog and check format, and each authoring skill owns its templates.
Validation entry point: `skills/write-skill/scripts/quick_validate.py`.
