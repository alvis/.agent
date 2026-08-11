# Concurrent local and Notion edits

Load this reference for every materialization refresh and completion. It is the
decision table for preserving development-time edits when Notion and the target
project change independently.

## Three-copy model

- **B — immutable base**: the exact verified remote bytes from the last
  successful materialization/completion, stored under
  `artifacts/spec-sync/bases/<base-id>/` and described by the
  matching `materializations/<base-id>.json` receipt. `<base-id>` is a stable
  unique identifier for the recorded base (for example the observed remote
  revision sanitized for filesystem use).
- **L — authored local**: the work-local specification under `spec/`. This is
  the only copy developers author during the work item.
- **R — fresh remote staging**: a new recursive Notion pull into a unique
  staging directory. Never compare against a previously cached mirror as if it
  were current remote state.

Compare the specification content directly (byte-for-byte, or via `git diff`).
Semantic comparison disregards only the declared volatile Notion
`last_edited_time` line; exact comparison covers the full bytes, stable
identity, path, and revision. Keep B read-only. A new verified exact state
creates a new base directory and receipt; it never rewrites an existing receipt
or base. `state.md` may point to the current receipt, but the PM owns that
pointer.

## Materialize decision table

Pull R before making a decision, then compare L and R with B. `==`/`!=` in the
authoring columns means semantic content equality (disregarding the volatile
`last_edited_time` line); exact byte differences remain separately recorded.
`metadata_only` additionally requires unit-by-unit equality of carrier kind,
stable identity, logical id, path, and semantic content. Only `observed_revision`
and the uniquely allowed `last_edited_time` line may differ. A stable-identity,
logical-id, or
carrier-kind shift is `status: refused`, `classification: invalid_evidence`,
and `next_action: repair_evidence`. A verified path/layout
change with identities intact is `structural_change`, never metadata-only, even
when the aggregate semantic content remains equal:

| Base | Local against B | Remote against B | Result |
| --- | --- | --- | --- |
| absent, L absent | n/a | fresh | Initial materialization: atomically promote R, then create B and its receipt. |
| absent, L present | unknown | fresh | `status: refused`, `classification: baseline_required`, `next_action: establish_baseline`; preserve L byte-for-byte and do not infer a base. Exception: a new-page receipt that preserves pre-create L, proves creation authorization and the stable identity/parent transition, and records post-create approval plus exact R verification may atomically establish verified R as initial L/B. |
| present | clean (`L == B`) | unchanged (`R == B`) | `status: success`, `classification: unchanged`, `next_action: none`; preserve L and the current receipt. |
| present | clean (`L == B`) | semantic unchanged, only `last_edited_time`/revision changed, structured-unit restriction passes | `status: success`, `classification: metadata_only`, `next_action: none`; verification-pull and atomically refresh the exact base evidence without invalidating semantic dependents. |
| present | clean (`L == B`) | semantic unchanged, verified path/layout changed with identities intact | `status: success`, `classification: structural_change`, `next_action: revalidate`; atomically promote fully verified R, create a new base/receipt, and invalidate dependent approval/plan/code/review. Identity/logical-id/carrier-kind drift is `status: refused`, `classification: invalid_evidence`, `next_action: repair_evidence`. |
| present | clean (`L == B`) | changed (`R != B`) | Atomically replace L from staged R, create a new base/receipt, and return `status: success`, `classification: remote_only`, `next_action: revalidate` when plan, review, or implementation evidence already exists. |
| present | dirty (`L != B`) | unchanged (`R == B`) | `status: success`, `classification: local_only`, `next_action: none`; preserve L and do not rewrite the receipt. |
| present | dirty (`L != B`) | semantic or structural change | `status: success`, `classification: materialization_conflict`, `next_action: resolve_conflict`; preserve L and all canonical transport bytes. Return B/L/R paths and content differences to the content owner. |

For the conflict row, equality between the final L and R semantic content may be
reported as a converged proposal, but it is still not promoted during a
materialize run: the content owner must establish it as a new reviewed base.

## Completion decision table

Completion also pulls R first. Evaluate each stable-identity pair by direct
content comparison without modifying L, the selected mirror, or Notion; retain
all exact bytes/revisions for the publication gate:

| Relationship | Classification | Allowed action |
| --- | --- | --- |
| B missing for an existing L or remote page | `baseline_required` | Return `status: refused`, `next_action: establish_baseline`; establish/reconcile a base explicitly. |
| `L == B` and `R == B` | `unchanged` | No push; verification may retain the receipt. |
| semantic B/L/R equal; only R `last_edited_time`/revision differs and structured-unit restriction passes | `metadata_only` | Return `status: success`, `next_action: none`. No semantic reapproval. Verification-pull and establish a new exact base/receipt; never reuse old revision evidence. |
| semantic content equal; R verified path/layout differs with identities intact | `structural_change` | Return `status: success`, `next_action: revalidate`. Do not push; materialize the verified structure and invalidate dependent evidence. Identity/logical-id/carrier-kind drift is `status: refused`, `classification: invalid_evidence`, `next_action: repair_evidence`. |
| `L != B` and `R == B` | `local_only` | Eligible to stage for publication only when the final L content has the stage-specific approval/review. |
| `L == B` and `R != B` | `remote_only` | Do not push. Return `status: success`, `next_action: revalidate` and reconcile the new remote contract before review/implementation continues. |
| `L != B`, `R != B`, and `L == R` | `converged` | No push. Verify, then create a new immutable base/receipt. |
| `L != B`, `R != B`, and `L != R` | `concurrent` | Produce an explicit three-way merge proposal from B/L/R. At specification stage the PM/user may resolve it and approve the final merged content. At implementation stage return `status: success`, `next_action: specification_reconciliation`; do not apply or push M there. |

Never use timestamps alone to select a winner. A worker may compute diffs and
merge proposals, but may not ask the user, select a winner, or apply
content. `Keep Both` is synthesized new content and therefore requires explicit
approval of the resulting content. `Skip` leaves that pair's
L, mirror, and remote bytes untouched; it must never insert a TODO or proceed
to push.

For implementation-stage concurrency, the approved merged proposal M must go
back through the selected source owner's authoring path, then
`sync-spec complete --stage=specification`. Require specification approval of the
exact content, guarded publication, verification pull, a new immutable
base/receipt, and a follow-up materialization before continuing. Invalidate the
old plan approval, implementation, alignment review, usage trace, and the review's
content binding; replan, reimplement, rereview, and rerun implementation
completion against the new content. An implementation-stage run never pushes an
unreviewed M.

## Approval and publication gate

Freeze the selected pair set and stage every final proposal before canonical
writes. If a pair is skipped, unresolved, failed, or changes during staging,
do not modify or push that pair. A specification-stage completion requires
explicit specification approval of the final specification content. An
implementation-stage completion requires a clean implementation review that was
performed against that exact final content, confirmed by direct comparison.

Immediately before each push, fetch/re-diff the remote page and require the
same remote revision/hash used to build R. Require the selected transport
profile to independently prove `conditional_update` support through its
conformance evidence; use that exact vector and record the condition.
Otherwise return `status: refused`, preserve the observed B/L/R
classification, set `next_action: provide_conditional_transport`, and change
neither Notion nor canonical L/mirror bytes. Repeated reads, timing assumptions,
and user acknowledgement do not replace an atomic remote precondition.

After push, verification-pull the complete selected pair and require exact
identity/content. Only then update canonical L/mirror bytes atomically and
create the new immutable B/receipt. If a remote write partially succeeds,
report the exact pair and recovery evidence; never claim all-or-nothing success.
