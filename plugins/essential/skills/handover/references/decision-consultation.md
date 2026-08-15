# Decision consultation

Consult every unresolved material architecture, technology, product, security,
data, migration, configuration, or scope decision before handover. Low-impact
reversible assumptions may remain in `state.md` only with evidence, impact, and
a recheck trigger.

For each decision, present context and viable options with tradeoffs, always
including:

- **Perform research** — dispatch bounded research using
  [subagent-handover.md](../../../references/directions/subagent-handover.md),
  with the unresolved decision and evidence paths in Context, and store its
  lowercase output under `proposals/` with status `open`.
- **Defer decision** — record owner/deadline, blocked tasks, and a pivot signal.

Process outcomes:

- Finalized: write/update `decisions/<semantic-slug>.md` with status, headline,
  rationale, alternatives, evidence, impact, and supersession; PM reconciles
  `decisions.md` and affected `state.md` tasks.
- Research: write a `proposals/` child and return its path/headline/status to
  the PM for `proposals.md` reconciliation.
- Deferred: keep the question, options, recommendation, owner/deadline, and
  affected blocked tasks in `state.md`; create a decision child only when
  durable decision history already exists.

If the user is unavailable, defer rather than decide. Batch five or more
questions by dependency, placing blockers first. Every created or materially
rewritten child belongs in `generated_files`; never update `state/working.md` from a
delegated decision/research subtask.
