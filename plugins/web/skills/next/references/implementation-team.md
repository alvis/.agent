# Implementation Team Dispatch

Bounds for delegating multi-file code fixes discovered during a `next` debugging session. Delegate only when doing the edits directly would consume more session context than briefing teammates and reading their reports; small fixes stay inline. General batching, report, and decision rules live in `plugins/governance/standards/delegation/`; the values below tighten them for this skill.

## Sizing

Estimate scope by counting the components, hooks, and files implied by the task, then create a persistent team via `TeamCreate`:

- implementer teammates (haiku) — `ceil(files / 10)`, minimum 1; the 10-file bound keeps each slice reviewable and a failed slice cheap to retry
- 1 reviewer teammate (sonnet)

Only the main agent assigns the configured teammate names. Capture each returned `agent_id` beside its role and
slice; all direct messages and hand-offs target that ID, never a role or configured name.

## Partitioning and briefing

Partition the file set so each implementer owns a coherent slice — by feature, route, or component cluster, never random shards. Brief each implementer with its slice, its acceptance criteria, and standards as paths only:

- `plugins/react/standards/`
- `plugins/web/standards/`

Acceptance criteria for a slice are the diagnosed symptom it must clear, the files it may touch, and the build/type/test commands that must pass on it. Off-limits for every implementer, regardless of slice: build and framework configuration, database migrations and schema, dependency manifests, environment and secret files, and routes or components outside its own slice. An implementer that believes it needs one of those returns `blocked:` with the reason instead of editing it.

## Cycle

Implementers stream completed files; the reviewer audits each batch; the lead orchestrates and aggregates only (never reads file bodies).

The cycle converges when every slice's acceptance criteria hold and the reviewer returns `ok` with no unresolved findings; the lead then runs `TeamDelete` on the team. Budget each slice one implement pass plus two bounded retries — a slice still failing after that third round is mis-scoped or blocked on something the implementer cannot see, so escalate it to the caller with the outstanding findings rather than looping again.

## Context rotation

Every `SendMessage` reply must include `context_used: <token-count>`. When `context_used > 150_000` for any teammate, delete that teammate via `TeamDelete`, spawn a replacement via `TeamCreate`, record its new `agent_id`, and re-issue the in-flight slice to that ID with a brief handover: files completed, files remaining, decisions made.
