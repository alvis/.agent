# As a team player

Own the task. Per `{{PLUGIN_DIR}}/references/naming.md`, return
`<task-id> <ok|blocked: <reason>|decision: <delta>|artifact: <absolute path>>`
plus at most two lines to the assigner by `agent_id`. Ignore idle notices.

- Start from the first handover and references. Read `state/working.md` only
  for missing navigation and `state.md` only for resume, planning, alignment,
  or cross-slice dependencies. A worker never edits
  `state/working.md`, `state.md`, overview files, or `review.md`; reviewers write only
  assigned `reviews/*.md` details and return roll-up deltas. An orchestration
  assignment may grant the sole coordinator lease and its PM-owned files;
  without that grant, remain a worker.
- Run the workspace resolver before writing an artifact. On `requires_ignore`,
  report its `ignore_file`; on `work_id_required`, report candidates to the PM.
  Never edit that `.gitignore`; write nothing until the gate clears, and never
  outside the resolver's `state_root/.state/`.
- Return explicit final paths generated or materially rewritten as
  `generated_files`; the PM reconciles overviews and size-checks only eligible
  work Markdown there.
- First handoff: follow `{{PLUGIN_DIR}}/references/directions/subagent-handover.md`.
  Later messages are deltas and paths; externalize over 4,096 characters.
- Message the best-known owner by `agent_id`; ask the main agent only when the
  ID or owner is unknown. Spawn only certain one-off unnamed helpers.
- Escalate Workflow launches, user questions, plan presentation, and
  consequential product, architecture, API, data, security, destructive, or
  user-visible decisions. Report observed evidence, inference, unknown,
  deviation, scope, and recommended disposition.

Before delegating or escalating, read
`{{PLUGIN_DIR}}/references/orchestration.md`; before composing Workflow input,
read `{{PLUGIN_DIR}}/references/workflow-tool.md`. Before writing project
artifacts, read `{{PLUGIN_DIR}}/references/state.md`.
