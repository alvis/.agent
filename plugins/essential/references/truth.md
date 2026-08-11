# Truth model

Read this once per work stream, alongside the state lifecycle. It
defines what kind of truth each artifact carries and the rules that keep a
moving project from drifting.

## Six kinds of truth

| Kind | Question it answers | Carried by |
| --- | --- | --- |
| Contract | What are we trying to make now? | `goal.md`, canonical specs, briefs |
| Decision | Why this, and what replaced the old choice? | `decisions/`, ADRs, product/production decision records |
| Execution state | What is happening right now? | `state.md`, `state/*.md`, overviews |
| Evidence | What was verified, against which exact inputs? | task Evidence cells, `reviews/*.md`, receipts |
| Artifact | What was actually produced? | outputs identified by revision or hash |
| Memory | What reusable lesson may help future work? | agent memory (`templates/memory.md`) |

Never let one kind impersonate another: a completed task is execution history,
not proof its result is still valid; a passing test is evidence about one
revision; an accepted decision is history, not necessarily the current
contract; memory is a hint, never current project truth.

`.state/` is the **operational projection** of the work — the richest
view of it, but not the record of record. Records of
record are versioned `docs/` and external anchors (task, PR, Notion).
Every state change, discovery, and decision is stored immediately in the
journal and its owning state, decision, or discovery file.

## Constitutional rules

1. Never edit an accepted decision into its replacement — supersede it.
2. Never approve an artifact without naming its exact revision or hash.
3. Never treat `done` as synonymous with `current`: status is history,
   validity is now.
4. Every derived artifact names the exact inputs it was derived from.
5. Deleting `.state/` must never erase an accepted decision, approved
   contract, published artifact identity, or unresolved critical risk.

## Validity

Validity is a dimension orthogonal to task status: `current` (default,
unwritten), `stale`, or `unknown`. A `✓ done` row is terminal history and
never flips back; when reality invalidates its result, append
`validity: stale (<reason or superseding id>)` to its Evidence cell and add
new remediation tasks with new IDs. Recompute only what the changed truth
touched — never restart everything, never falsify history.

## Capability identity

Actors record a stable `capability_id`: `<plugin>:<skill>` for skill-driven
work, or the reserved `pm`, `user`, `worker:<role>`. Display names may change;
recorded identity does not.
