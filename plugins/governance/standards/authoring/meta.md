# Governance Authoring Invariants

_Repository-wide policy for authoring coherent, operational skills, agents, and standards._

## Dependent Standards

You MUST also read the following standard when the authored artifact dispatches subagents:

- Delegated Execution (standard:delegation) - batching, message, report, review, and retry limits

`plugins/governance/skills/write-skill/references/authoring.md` separately owns the portable Agent Skills directory, frontmatter, resource, and validation contract.

## What's Stricter Here

| Standard Practice | Our Stricter Requirement |
|---|---|
| Helpful context may be retained | **Every shipped line must change what someone does** |
| Corrections may be appended | **New policy must replace superseded prose in one coherent document** |
| Concision may omit execution detail | **Concision must preserve decisions, failure behavior, and verification** |
| XML-like wrappers are stylistic | **Important or long content uses a semantic, balanced boundary tag** |

## Exception Policy

Allowed exceptions only when:

- False positive
- No viable workaround exists now

Required exception note fields:

- `rule_id`
- `reason` (`false_positive` or `no_workaround`)
- `evidence`
- `temporary_mitigation`
- `follow_up_action`

If exception note is missing, submission is rejected.

## Rule Groups

- `AUT-CONT-*`: Load-bearing, coherent, operationally sufficient content.
- `AUT-BOUN-*`: Semantic content-boundary tags and balanced structure.
- `AUT-DELG-*`: Context-economic delegation decisions.
