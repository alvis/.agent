---
name: review-implementation
description: Review implementation against an authoritative local, inline-origin, or Notion specification, coordinate the seven canonical review areas, and summarize dispositions in the active work item. Use for alignment, ticket validation, omissions, drift, and unsanctioned behavior.
requirements:
  intelligence: high
argument-hint: "[specifier] [--work-id=<id>] [--plan-source=<path>] [--transport-root=<dir>] [--transport-profile=<absolute-file>] [--area=alignment|correctness|security|quality|testing|docs|style|all]"
---

# Review Implementation

Coordinate specification alignment and the general Coding review without
duplicating their detection protocols. Write canonical lower-case work-local
review artifacts and one disposition summary.

## Boundaries

- Require a verified authoritative specification and its durable provenance.
  Local and inline-origin carriers resolve through their durable receipt;
  invoke `sync-spec` to materialize only a selected Notion source. Identify
  Notion sources by receipt/frontmatter ref, not filename. A reachable `repo:`
  source remains authoritative even when the caller passes its derived carrier.
- `alignment.md` owns contract conformance. `correctness.md` owns semantic bugs
  that are wrong independently of the specification. The other areas are
  `security.md`, `quality.md`, `testing.md`, `docs.md`, and `style.md`.
- Do not create `audit.md`, `deviations.md`, review `readme.md`, root review
  files, or duplicate a finding across areas. Contract/completeness audit gaps
  route to alignment; plan departures stay in work state/changes.
- Review remains read-only with respect to implementation and MDC.
- Each reviewer writes only its assigned `reviews/<area>.md`. The
  PM/coordinator alone reconciles `review.md` after all area writers return.

## Inputs and outputs

For a direct run, run Essential's workspace resolver with `--work-id` only for
an explicit user override and accept its deterministic environment,
Git-branch/jj-workspace, or sole-existing-work match. Ask only when it returns
`work_id_required`, using its returned candidates. A delegated run receives the
explicit id/root. Resolve area output under the active work's `reviews/`;
`--area=all` is default. Alignment-only still runs mandatory correctness and
security coverage through `coding:review-code`.
For a Notion source that may require materialization, accept the exact transport
root plus explicit absolute `--transport-profile` file, or resolve one
destination-local file from an active-state mapping containing logical name and
last verified exact-byte SHA-256. Never infer its location from that name/root.
Root `state.md` is authoritative and must report `plan_source: state.md` with
its task definitions and graph. Optional values passed by a lifecycle parent
are assertions that must match it, not overrides. An explicit detail link may
be followed for ID-keyed implementation procedure, never for task definitions.

## Workflow

1. Before creating or materially rewriting a project artifact, read the
   absolute `state.md` path injected by Essential. If unavailable,
   stop artifact writes and report the missing contract. Use the workspace
   resolver result for work/review roots and read only the exact state/spec
   pointers needed for alignment. Read root `state.md` (and any `state/*.md`
   children) directly; from the task table, determine which tasks are
   runnable, which are blocked, the current owner, and the next action, and
   proceed on that reading — there is no separate validation step. Confirm
   `plan_source: state.md` and retain its canonical `plan_source`,
   task definitions, and task graphs. Reject an invalid graph or any
   caller-supplied plan identity that differs from the read state. Follow
   only root state's explicit implementation-detail link and reject any
   duplicate/contradictory task IDs, edges, requiredness, targets, or
   acceptance mappings there. Never guess between directory children or a
   root planning file.
2. Resolve the selected source, durable carrier, and provenance before review.
   For a reachable `repo:` local source, compare the source and carrier content
   directly against provenance, require both to match the approved specification
   content, and use the content-derived Git blob oid as optional revision
   evidence. Missing/moved source, source drift, stale provenance, or carrier
   drift returns `ready_for_specification`; never review whichever copy happened
   to be passed. For `local-approved:` or `inline-approved:` provenance, compare
   the sole authoritative durable carrier without requiring the ignored origin.
   For a Notion URL/id whose verified materialization receipt is stale or
   missing, invoke `Skill(sync-spec)` in `materialize` mode with the selected
   transport root and explicit `--transport-profile=<absolute-file>`; the child
   revalidates the selected file. Continue only on `status: success` with
   `next_action: none`; a `remote_only` or `structural_change` classification
   with `next_action: revalidate` returns `needs_revalidation` before dispatch.
   Refuse without partial reports when no authoritative specification can be
   resolved. Bind the review to the exact approved specification content; pass
   that content reference to every reviewer, along with the canonical plan
   source and task definitions and applicable full task IDs. Never combine findings
   produced against different specification content or task definitions.
3. Resolve implementation scope with `coding:review-code` semantics. Enumerate
   requirements, invariants, schemas, acceptance criteria, and non-functional
   posture; when the charter `goal.md` defines `SC-n` success criteria, include
   each as an alignment obligation and cite the covered `SC-n` IDs in findings
   and dispositions, so closure is checkable per criterion — every required
   criterion needs an `applied` change and a closed disposition covering it.
   Trace spec-to-code for omission/drift and code-to-spec for
   unsanctioned behavior; search the repository before declaring absence.
4. Adversarially refute each candidate and retain only survivors. Every
   alignment finding cites both spec and implementation locations and uses
   stable `ALIGN-P<n>-<seq>` identity across reruns.
5. Load every existing canonical area artifact into the reconciliation view,
   preserving its latest evidence and verdict even when that area is not
   selected on this run. Invoke `Skill(coding:review-code)` for requested
   non-alignment areas, including correctness and security on every run. Pass
   the work id, canonical plan identity, applicable full task IDs, and exact
   assigned area paths—not an output override—and state
   that spec conformance belongs only in `alignment.md`. Each area writer
   returns counts/deltas.
6. Reconcile alignment findings with the user: update spec, update code,
   acknowledge/waive, defer, or skip with required closure metadata. Apply the
   lifecycle in [references/deviation-lifecycle.md](references/deviation-lifecycle.md).
   A decision does not clear a gap until its action lands, except valid
   acknowledgement/skip risk acceptance. P0/P1 risk acceptance requires
   explicit authority and durable evidence.
7. Rewrite only the assigned `alignment.md` coherently. Aggregate preserved
   existing area results with current-run deltas. Return each executed area's
   canonical `pass|pass_with_suggestions|requires_changes|fail` verdict, count,
   finding-disposition (`open`, `fixed`, `acknowledged`, `deferred`, `skipped`)
   deltas, and next-action pointers to the PM/coordinator. Use `not_run` only
   when an area has no existing or current execution evidence; it is not a
   finding disposition. Never write `review.md` or copy full findings into the
   handoff.
8. Re-run the complete Step 2 source/carrier authority and direct content
   comparison, plus the Essential state re-read from Step 1, immediately before
   finalization. Source/provenance/carrier drift returns
   `ready_for_specification`; changed specification content or task
   definitions return `needs_revalidation`. In either case discard the stale roll-up and do not
   emit a clean verdict. Only a sync-spec `classification: metadata_only` that
   passed its unit-by-unit restriction may update paired revision evidence
   without invalidating findings; `structural_change` invalidates them even when
   the content is otherwise unchanged. Re-read `state.md` and the task table
   directly, fix once, and re-read to confirm.
   Return explicit final paths generated or materially rewritten as
   `generated_files`.
   Do not run file sizing; the PM checks only eligible work Markdown inside the
   target `.state/`.

## Verification

- All seven canonical areas appear in the reconciliation payload. An area with
  no existing or current execution evidence is `not_run`; it is never encoded
  as skipped/refused. Correctness and security have current-run evidence and
  therefore can never be `not_run` on a completed review.
- Findings are single-owned, source-cited, adversarially checked, and their
  dispositions/counts agree between detail and summary.
- Stable IDs and prior reconciliation survive reruns; only closed gaps clear.
- A clean disposition is bound to the exact approved specification content;
  confirm by direct comparison. Specification content changes invalidate it even
  when implementation bytes are unchanged.
- A clean disposition is also bound to the reviewed task definitions. Status,
  owner, and evidence updates retain it; task-definition changes require
  re-review.
- Every approval carries the full binding tuple from Essential's
  `approvals.md`: artifact id, its content hash or immutable revision,
  reviewer (`capability_id` or user) and authority, approved scope, and
  unresolved exceptions. `needs_revalidation` marks affected done work
  `validity: stale` per the state contract; it never flips a `✓ done` row.
  Approvals are journaled state changes under the same append-first
  discipline as every other state change.
- `generated_files` lists every changed area artifact; the separate PM
  reconciliation payload names the roll-up delta without claiming it was written.

## Alignment contract

For each requirement record requirement, spec location, implementation
location, `satisfied|missing|drift|unsanctioned`, severity, evidence,
disposition, and next action. A broken acceptance criterion/weakened invariant
is P0; contract drift is P0/P1 by blast radius; documentation-only divergence
is P2/P3. Keep independently wrong behavior in `correctness.md`.

## Completion

<report>

```yaml
status: success|partial|ready_for_specification|needs_revalidation|refused
work_id: '<id>'
specifier: '<target>'
spec_root: '<absolute path>'
reviewed_spec_revision: '<observed revision or Git blob oid>'
reviewed_content_ref: '<durable reachable locator to the exact reviewed spec content; required when reviewed_spec_revision is empty or only a carrier blob (inline/local-approved), so implement-code confirms a match by direct comparison instead of a removed hash>'
plan_source: state.md
reviewed_task_ids: []
reviewed_task_defs: {}  # full task ID -> immutable definition reviewed (summary [targets] | required=<yes|no> | acceptance=<criterion>); unchanged IDs alone do not prove definitions held
transport_profile: {profile_file: '<absolute destination-local path or null>', profile_file_sha256: '<sha256 or null>'}
areas: {alignment: pass, correctness: pass, security: pass, quality: not_run, testing: not_run, docs: not_run, style: not_run}
dispositions: {open: 0, fixed: 0, acknowledged: 0, deferred: 0, skipped: 0}
closure: {closed: 0, outstanding: 0}
review_reconciliation: {summary_written: false, owner: pm}
generated_files: []
next_action: execute|revalidate|handover|defer
```

</report>
