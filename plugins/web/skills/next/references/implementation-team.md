# Implementation Team Dispatch

Bounds for delegating multi-file code fixes discovered during a `next` debugging session. Use this team only when the invoking agent already owns implementation for the affected files; otherwise hand the diagnosis to `frontend-implementer` or the documented implementation owner. General batching, report, and decision rules live in `plugins/governance/standards/delegation/`; the values below tighten them for this skill.

## Sizing

Estimate scope by counting the components, hooks, and files implied by the task, then create a persistent team through the agent-lifecycle capability:

- low-intelligence implementer teammates — `ceil(files / 10)`, minimum 1; the 10-file bound keeps each slice reviewable and a failed slice cheap to retry
- 1 medium-intelligence reviewer teammate

Only the main agent assigns the configured teammate names. Capture each returned `agent_id` beside its role and
slice; all direct messages and hand-offs target that ID, never a role or configured name.

## Partitioning and briefing

Partition the file set so each implementer owns a coherent slice — by feature, route, or component cluster, never random shards. Brief each implementer with its slice, its acceptance criteria, and standards as paths only:

- `plugins/react/standards/`
- `plugins/web/standards/`

Acceptance criteria for a slice are the diagnosed symptom it must clear, the files it may touch, and the build/type/test commands that must pass on it. Off-limits for every implementer, regardless of slice: build and framework configuration, database migrations and schema, dependency manifests, environment and secret files, and routes or components outside its own slice. An implementer that believes it needs one of those returns `blocked:` with the reason instead of editing it.

## Cycle

Implementers stream completed files; the reviewer audits each batch; the lead orchestrates and aggregates only (never reads file bodies).

The cycle converges when every slice's acceptance criteria hold and the reviewer returns `ok` with no unresolved findings; the lead then retires the team through the agent-lifecycle capability. Budget each slice one implement pass plus two bounded retries — a slice still failing after that third round is mis-scoped or blocked on something the implementer cannot see, so escalate it to the caller with the outstanding findings rather than looping again.

## Context rotation

Every direct teammate-messaging capability reply must include `context_used: <token-count>`. When `context_used > 150_000` for any teammate, retire that teammate and spawn a replacement through the agent-lifecycle capability, record its new `agent_id`, and re-issue the in-flight slice to that ID with a brief handover: files completed, files remaining, decisions made.
