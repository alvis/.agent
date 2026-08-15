---
name: plan-code
description: Build an implementation-ready plan from an approved specification inside an active work stream. Use to resolve the decision surface, define atomic implementation slices, and prepare verification without creating independent root planning or change artifacts.
model: opus
argument-hint: "[--work-id=<id>] [--spec=<path-or-ref>] [--change=<description>]"
---

# Plan Code

Turn an approved work specification into a decision-complete implementation
blueprint stored with the active work item. `specification:spec-code` owns the
contract; `specification:implement-code` and Coding skills execute it.

## Boundaries

- Follow Essential's
  [Making plans](../../../essential/references/directions/plan.md); this skill
  adds specification and task-registry requirements without redefining that
  shared contract.
- Root `state.md` is the sole canonical plan definition and contains the
  complete task registry; its `plan_source` is exactly `state.md`.
  `state/plan.md` is non-authoritative implementation
  detail keyed by existing task IDs. Proposals, changes, decisions,
  and design reasoning use the corresponding work-local child folders.
- `goal.md` is the PM-owned charter (goal, scope, numbered `SC-n` success
  criteria, specification provenance). Planning consumes it and proposes
  charter content as reconciliation payload; it never edits the file, and for
  a Notion-backed contract the canonical specification remains the sole
  authority over the charter.
- `state/working.md` is a temporary current-focus summary, not the plan. Only the PM
  writes it and reconciles the four overview indexes.
- Do not implement source code, mutate history, or change authoritative MDC.

## Inputs

- **Required**: an approved specification reachable from an explicit source or
  the active work state.
- **Optional**: work id, explicit spec path/ref, focused change, discovery
  evidence, and current repository standards/architecture.

## Workflow

1. Before creating or materially rewriting a project artifact, read the
   absolute `state.md` path injected by Essential. If unavailable,
   stop artifact writes and report the missing contract. For a direct run, run
   Essential's workspace resolver with `--work-id` only for an explicit user
   override and accept its deterministic environment, Git-branch/jj-workspace,
   or sole-existing-work match. Ask only when it returns `work_id_required`,
   using its returned candidates. A delegated run receives the explicit
   id/root. Read only the exact state, receipt, and specification pointers
   required for this plan. Load the durable provenance recorded by `spec-code`.
   For a reachable `repo:` local
   source, that source remains authoritative even when the caller names the
   derived carrier: compare source and carrier content directly against
   provenance, and require both to match the approved specification content. Use
   the content-derived Git blob oid (computed from the exact bytes even before
   commit), not an unrelated commit oid or index state, as optional revision
   evidence. Missing/moved source, source drift, stale provenance, or carrier
   drift returns `ready_for_specification` and routes through `spec-code`; never
   plan from whichever copy happened to be passed. For `local-approved:` or
   `inline-approved:` provenance, the content-equivalent durable carrier is the
   sole reachable authority and the original content is historical evidence, so
   compare the carrier without requiring the ignored origin. Notion authority
   remains its selected materialized/verified source receipt. Require a
   specification approval of the resulting specification content. A missing
   approval returns `ready_for_spec_approval`; content that differs from the
   approved specification returns `ready_for_specification`, without planning
   from stale intent.
2. Treat any legacy root design/draft/plan/proposed/change files as read-only
   migration inputs. Do not overwrite or delete them. Report ambiguous mapping
   for PM disposition.
3. Build the decision surface before implementation detail: data/migrations,
   public interfaces, user-visible flows, dependencies, security/privacy,
   integration boundaries, and acceptance criteria. Classify each as resolved,
   accepted reversible assumption with recheck trigger, deferred with owner and
   deadline, or blocking. Route discovery/decision work to the owning skills.
4. Ask only material unresolved questions. Once none block execution, write
   detailed lowercase artifacts as needed:
   - `decisions/<slug>.md` for a choice and consequences;
   - `proposals/<slug>.md` for a task or change not yet implemented, derived
     from the canonical spec for the work stream (approval is a status on the
     child, `open` then `accepted`; it stays here until implemented);
   - `changes/<slug>.md` for the final implementation documentation once the
     work is done, plus any last-mile changes made during implementation (a
     proposal shifts here as it is implemented); record any deviations from the
     canonical spec in a section within either;
   - `design/<slug>.md` for temporary task-specific technical design;
   - always after Step 5 assigns stable IDs, `state/plan.md` for
     interfaces, implementation notes, test procedure, repository gates,
     assumptions, and pivot signals keyed by those proposed IDs. It must not
     duplicate or override IDs, dependencies, requiredness, targets, or
     acceptance mappings, and becomes usable only after PM root reconciliation.
   Ordinary work children always use an unnumbered semantic slug. Reserve
   `<nn>-<topic-slug>.md` for split output only; durable ADRs alone use
   `docs/architecture/decisions/<nnnn>-<decision-slug>.md`.
   Read `${ESSENTIAL_ROOT}/references/adr.md` before creating or superseding an
   ADR. A superseding ADR stands alone; the prior ADR is moved under
   `decisions/superseded/` with the required archive header and is removed from
   the current ADR index.
5. Assign every top-level task one globally unique mnemonic ID matching
   `^[A-Z]{3}$`. Assign each executable child its parent's ID plus `01`-`99`
   (for example `LFE01`); allow only this one child level. Once approved, never
   rename, reuse, or recycle an ID, including after cancellation. A parent with
   children is a derived roll-up, never executable. Record every dependency
   explicitly by full ID: parent edges reference parents and child edges
   reference siblings under the same parent. Prohibit cross-parent child edges,
   self-edges, dangling edges, and cycles. Use a simple chain by default and a
   DAG such as `LFE -> {API,DOC} -> VAL` only when work is genuinely
   independent. Display order and optional diagrams are non-authoritative.
   Make each executable leaf atomic and independently verifiable. Put its
   source targets and acceptance mapping in the root reconciliation row; where
   the charter defines `SC-n` success criteria, cite the covered IDs in the
   acceptance mapping so closure is checkable per criterion. The
   detail may expand implementation intent, test procedure,
   repository gates, and conventional commit intent under that existing ID,
   while citing rather than restating the root definition. Use the
   canonical task table and status vocabulary from Essential; all tasks begin
   `- planned`. The root task table is the complete registry of parents and
   children. A resumable child may mirror a subset but cannot introduce IDs.
   Encode each Task cell as
   `<summary> [targets: <comma-separated paths>|none]`; targets ride inside the
   task cell, not a tenth column. Include code only where an exact interface or migration shape
   is needed to prevent implementer choice; do not duplicate whole files.
   Include the shared direction's Context navigation in the root reconciliation
   payload, linking decisions and recent work rather than copying their detail.
6. Re-run the Step 1 source/carrier authority check immediately before freezing
   the plan. Dispatch one read-only reviewer with the authoritative spec and its
   approved specification content, proposed root task registry,
   ID-keyed implementation detail, decisions, and repository standards. It verifies complete acceptance/test
   mapping, architecture consistency, schema/API fidelity, executable order,
   and absence of hidden decisions. Resolve findings and review once more.
   Review the proposed complete root task registry together with any
   non-authoritative ID-keyed detail. Set `plan_source: state.md`. Ask the PM to
   reconcile the complete registry and that exact pointer into root state.
   Read the reconciled root `state.md` (and any `state/*.md` children)
   directly; from the task table, determine which tasks are runnable, which
   are blocked, the current owner, and the next action, and proceed on that
   reading — there is no separate validation step. The plan is the task
   definitions and dependency graph themselves — task IDs, definitions,
   dependencies, requiredness, targets, and acceptance mappings — as written in
   `state.md`, independent of marks, runtime status, owners, evidence,
   timestamps, formatting, and derived diagrams. Present the material
   decisions and DAG, and require explicit approval of those task definitions.
   Any definition change preserves the prior root state, re-reads the updated
   state file to identify the invalidated downstream closure, and returns
   `ready_for_plan_approval`; status-only reconciliation retains approval.
7. Return the complete `state.md` reconciliation payload, including
   `plan_source`, the resulting `Plan revision` (initial approval sets `1`; an
   approved definition change bumps it and carries a `state/revisions.md`
   entry naming what changed, why, the approver, and the exact spec base-id
   approved against when one exists), any proposed charter content for
   `goal.md`, parent/leaf task rows, and the four overview rows/status deltas
   to the PM. Do not directly
   edit PM-owned `goal.md`, `state.md`, `state/working.md`,
   `state/journal.md`, `state/revisions.md`, `proposals.md`, `changes.md`,
   `decisions.md`, or `design.md`.
8. Return explicit final paths generated or materially rewritten as
`generated_files`. Do not run file sizing; after every writer finishes, the PM
checks only eligible work Markdown inside the target `.state/`.

## Verification

- Every acceptance criterion maps to at least one executable task and one
  verification action.
- Every task ID appears once, has dependency-safe edges, and introduces no
  unresolved material decision.
- Temporary detail is work-local, legacy root files are untouched, and PM-owned
  indexes have explicit reconciliation data.
- The read-only quality gate passed and `generated_files` is complete.
- Specification approval binds to the exact approved specification content;
  plan approval binds to the exact approved task definitions. Neither survives its
  corresponding definition change, but task status/evidence changes do not
  invalidate plan approval. Reachable `repo:` source drift cannot hide behind
  an unchanged derived carrier.

## Completion

Report work id, authoritative source/carrier/receipt content references and the
approved specification content, authority kind (`repo` source or promoted carrier), decisions and
proposals created, `plan_source`, plan approval, parent and
executable task counts, overall and per-parent dependency graphs,
quality-gate result, legacy migration issues, PM reconciliation payload, and
`generated_files`. A refusal names the missing spec, work state, repository, or
blocking decision.
