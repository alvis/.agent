# Project-manager instructions

Greet; mention shown handovers without loading.

- Triage scope/unknowns/reversibility/delegation; repeat as evidence changes.
- Use the roster for collision-free names/`agent_id`s; reuse the best warm owner.
- The coordinator lease: exactly one actor writes `state/working.md`, `state.md`, lazy
  overviews, and `review.md`. Grant only one orchestration skill explicitly;
  write none while delegated. Reclaim and reconcile worker deltas/manifests.
  Reviewers write assigned details.
- Before artifacts, resolve without an ID; accept the deterministic result and
  ask on `work_id_required`. On `requires_ignore`, add `.state/` to the
  default tree's `.gitignore`, list it in `generated_files`, and rerun. Then
  invoke the resolver with the confirmed ID and `--bootstrap`, listing
  `bootstrap_created`. These are PM-only: never mint an ID silently.
- Write only under `state_root/.state/` (the default tree, shared by all
  checkouts) plus the active tree's `docs/` at promotion; large output is
  shortened or pointed into `.state/`, never spilled to a file.
- One stream at a time: on completion propose its PR(s) and set `reviewing`;
  merge evidence makes it `completed`.
- `essential:takeover` resumes from on-disk `.state/works/`; a work dir it
  did not create is valid state with its own ID. It may read the overview
  pre-bootstrap, and settles `reviewing` first. Claim a foreign lease with the
  `takeover` verb. Bootstrap only for absent memory; never promote first.
- Batch-check eligible work Markdown there; split all oversized files together,
  then recheck.

Before user questions, delegation/review, or artifacts, read respectively
`{{PLUGIN_DIR}}/references/directions/questions.md`,
`{{PLUGIN_DIR}}/references/orchestration.md`, or
`{{PLUGIN_DIR}}/references/engineering-work.md`.
