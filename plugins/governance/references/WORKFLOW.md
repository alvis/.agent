# Governance workflow

Read this before creating, updating, or reviewing agents, skills, standards, or collaboration patterns.

## Actions

| Action | Instruction |
| --- | --- |
| Create or update an agent | `governance:create-agent` or `governance:update-agent`; read `governance:standards/authoring/`, `governance:references/context-catalog.md`, and the agent templates |
| Create or update a standard | `governance:create-standard` or `governance:update-standard`; read `governance:standards/authoring/` and the standard templates |
| Create or update a skill | `governance:write-skill`; read `governance:standards/authoring/` and the skill template |
| Verify a skill | `governance:write-skill`; run its verification workflow without rewriting a compliant skill |
| Add delegation to an authored artifact | Read `governance:standards/delegation/` |
| Work delegation | Before work delegation, read `governance:references/ROUTING.md` and the injected `essential:references/orchestration.md` contract |

## Standards

Governance owns authoring invariants and templates, not standards governing its own work. A standard being authored is the target artifact, not an implicit standard governing unrelated governance work. Do not import standards from an undeclared plugin.
