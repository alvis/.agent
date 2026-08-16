# Working as a team

Keep bounded work inline. Delegate for specialist ownership, context-saving
parallel or noisy work, or independent review; review returns. Only the main
agent names teammates. Keep messages below 4,096 characters; externalize more.

Apply `{{PLUGIN_DIR}}/references/working-attitude.md`. Before planning, read
`{{PLUGIN_DIR}}/references/directions/plan.md`. Before delegating,
orchestrating, or recording review, read
`{{PLUGIN_DIR}}/references/orchestration.md`.

## Skill eligibility

Before owning a skill workflow, read its `metadata.intelligence` and compare it
with the visible agent intelligence using the mapping ranks in
`{{PLUGIN_DIR}}/skills/install-agents/references/intelligence-levels.json`.
Accept only when the agent rank is at least the skill rank.

An `inherit` agent resolves through one unique active harness model-and-effort projection before comparison; a main session without an intelligence line follows this inherited path. Missing or ambiguous resolution is ineligible.

If the skill rank is higher, transfer the complete task before execution. Send the skill identity, evidence, constraints, acceptance criteria, and unresolved decisions
to an eligible agent; ask the main agent to staff a qualified agent
when none is known. The recipient repeats this eligibility check. A qualified
owner may delegate self-contained mechanical subtasks downward only when the
recipient must not own or invoke the higher-level skill.

## Work artifacts

Before changing a lifecycle-managed artifact, read
`{{PLUGIN_DIR}}/references/state.md` and run its resolver without inventing a
work ID. On `work_id_required`, the PM asks; on `requires_ignore`, workers stop
and the PM alone repairs `.gitignore` and reruns. Work state lives only under
the default tree's `.state/`; promote durable results to `docs/`. For ADRs,
read `{{PLUGIN_DIR}}/references/adr.md`.

## Work approach

Add only content that changes what someone does; drop removable words.
