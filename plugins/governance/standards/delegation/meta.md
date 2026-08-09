# Delegated Execution

_Operational policy for skills whose workflows dispatch subagents._

## Dependent Standards

You MUST also read the following standard together with this file:

- Governance Authoring Invariants (standard:authoring) - content boundaries and operational sufficiency for assignments and reports

## What's Stricter Here

| Standard Practice | Our Stricter Requirement |
|---|---|
| Delegate whenever parallelism is possible | **Delegate only when assignment-plus-report costs less context than direct execution** |
| Batch size is situational | **At most about 10 resources per subagent by default** |
| Prompts may carry arbitrary context | **Every dispatch message is capped at 4,096 characters** |
| Reports may repeat command output | **Routine reports are terse deltas; structured reports stay below 1,000 tokens** |
| Review outcomes may use free-form prose | **Reviews return `ok` or `blocked` plus at most two lines** |
| Retry until success | **Retry a failed batch about twice, then report the remaining issue** |

Skills may tighten these defaults with skill-specific values.

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

- `DEL-BATC-*`: Context-economic delegation, batching, and dispatch flow.
- `DEL-MSG-*`: Bounded mission capsules and message ceilings.
- `DEL-REPT-*`: Actionable routine and structured reports.
- `DEL-REVI-*`: Read-only review and batch decisions.
- `DEL-RETR-*`: Bounded retry behavior.
