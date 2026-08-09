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
| `governance:create-skill` | Turning a repeatable workflow into a discoverable skill with clear ownership and triggers. |
| `governance:update-skill` | Revising existing skills, narrowing overlap, applying deliberate behavior changes. |
| `governance:verify-skill` | Structural + policy validation of a new or changed skill, with representative trigger reasoning and optional isolated runtime checks. |
| `governance:create-agent` | Scaffolding a new specialist agent from `base.md` plus split metadata, Claude, and Codex JSON sources. |
| `governance:update-agent` | Migrating selected agents to the current template or a stated behavior change. |
| `governance:create-standard` | Establishing a new standard (meta/scan/write + per-rule guides) under a plugin's `standards/`. |
| `governance:update-standard` | Scoped rule changes and template migrations for existing standards. |

`standards/` holds authoring and delegation policy, `references/` holds the
context catalog and check format, and each authoring skill owns its templates.
Validation entry point: `skills/write-skill/scripts/quick_validate.py`.
