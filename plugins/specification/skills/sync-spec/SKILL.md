---
name: sync-spec
description: Materialize a required Notion specification into an active work directory or complete approved specification changes through an explicitly selected local transport pair. Use before specification planning, implementation, or review and when publishing a reviewed contract. Delegate transport and conflicts to sync-notion.
model: opus
argument-hint: "<notion-url-or-id> [--work-id=<id>] [--mirror=<path>] [--transport-profile=<absolute-file>] [--mode=materialize|complete] [--stage=specification|implementation] [--capability=<slug>]"
---

# Sync Spec

Safely coordinate three copies of a Notion-backed specification: an immutable
recorded base, the work-local authored copy, and a fresh remote staging pull.
`specification:sync-notion` owns transport; `specification:mdc` owns authored
MDC body changes. Detect changes by comparing the specification content
directly (byte-for-byte, or via `git diff`), disregarding only the volatile
Notion `last_edited_time` line for semantic equality. Approvals bind to the
approved specification content, not to any hash.

## Boundaries

- `materialize` obtains a fresh remote view, then creates or refreshes only the
  requested page tree under `.state/works/<work-id>/spec/` when the
  base/local/remote decision permits it.
- `complete` is a publication gate. It reconciles the authored copy with a
  fresh remote view, verifies stage-specific approval, delegates guarded
  transport, verification-pulls, derives `docs/specs/<capability>/`, and
  reports dependent work that needs revalidation.
- Never derive or rename an MDC filename. Select files by stable `ref:` and the
  transport relationship report.
- Never call `notion-sync` directly, treat the selected mirror as an authoring
  surface, overwrite a fixed receipt, or infer that cached mirror bytes are the
  latest remote bytes.
- Never treat a metadata-only edit (only the volatile `last_edited_time` line
  differs) as a contract change, and never approve, plan, or review against
  content you have not compared directly against the recorded base.

## Inputs

- **Required**: Notion URL or page id.
- **Optional**: work id, exact `--mirror=<path>`, mode (default
  `materialize`), lowercase capability slug, and a verified creation receipt
  for an explicitly created new page.
- **Required for every Notion operation**: an explicit absolute
  `--transport-profile=<file>`, or an active-state destination mapping that
  names one absolute profile file, its last verified exact-byte SHA-256, and
  logical profile name. The mapping selects a file only; `sync-notion`
  revalidates its current bytes/executable on every invocation. Never infer a
  profile path from a logical name, mirror, workspace, or origin receipt.
- **Completion only**: `--stage=specification|implementation` is required.
  Specification stage requires explicit specification approval of the final
  specification content. Implementation stage requires a clean implementation
  review that was performed against that exact final content, confirmed by
  direct comparison.
- **Prerequisites**: injected Essential state contract, resolved
  active work, the strict destination/team profile required by `sync-notion`,
  and `NOTION_TOKEN`.

## Workflow

1. Read the absolute injected `state.md` contract before artifact
   writes. If unavailable, stop artifact writes and report the missing
   contract. For a direct run, invoke Essential's workspace
   resolver with `--work-id` only for an explicit user override; ask only on
   `work_id_required`. A delegated run receives the explicit id/root. Resolve:
   - `work_spec_root = <active>/.state/works/<work-id>/spec`;
   - `mirror_root` from explicit input, active state, or an immutable receipt;
   - `transport_profile_file` from explicit input or the exact validated
     active-state mapping described above;
   - `receipt_root = <work-dir>/artifacts/spec-sync`;
   - immutable receipts at `materializations/<base-id>.json` and base snapshots
     at `bases/<base-id>/`, where `<base-id>` is a stable identifier derived from
     the **full** accepted byte set of the base — all per-unit identities and
     their revisions together (sanitized for filesystem use) — never the root
     page's observed revision alone, which collides when a child page or layout
     changes while the root revision is unchanged and would let a later
     materialization overwrite or compare against a stale base.
   State may point to the current receipt, but the PM owns that update. Require
   the real work/mirror targets to be ignored and untracked in their owning VCS
   workspaces; otherwise return `requires_ignore` with the exact ignore file.
   Require the mapped logical name to equal the selected profile's `name` and
   pass the absolute file explicitly to every transport call. A missing,
   ambiguous, moved, or changed mapping returns `transport_unverified`;
   never fall back to `PATH` or a conventional file location.
2. Normalize the Notion id only for identity comparison and require 32 hex
   characters after dash removal. Resolve the selected recursive page set by
   returned `ref:`/relationship data, never filename shape. Load
   [references/concurrent-edit-matrix.md](references/concurrent-edit-matrix.md).
   Reject malformed/ambiguous carriers and duplicate identities/paths/logical
   unit ids. Use the three-copy rules for every later decision.
3. Before either mode decides anything, invoke `Skill(sync-notion)` in
   `notion-to-local` mode with the exact mirror root and
   `--transport-profile=<transport_profile_file>` into a unique remote staging
   directory. Verify full
   requested coverage, stable identity, and revision evidence. Store the exact
   pulled bytes and observed revision as immutable evidence for later direct
   comparison. Do not refresh the selected mirror or work copy yet.
4. In `materialize` mode, compare the current authored tree L and fresh remote
   staging R with immutable base B. Report operational `status` separately from
   `classification` and `next_action`. Before declaring `metadata_only`, compare
   every unit directly and require identical carrier kind, stable identity,
   logical id, path, and semantic content; only `observed_revision` and
   the uniquely allowed `last_edited_time` line may differ. A stable-identity,
   logical-id, or carrier-kind shift is invalid evidence and returns
   `status: refused`, `classification: invalid_evidence`, and
   `next_action: repair_evidence`. A verified path/layout rename with identities intact is
   `structural_change`, invalidates dependent evidence, and is never
   metadata-only:
   - absent L/B establishes the first base by atomic staging and promotion and
     returns `status: success`, `classification: initial`, and
     `next_action: none`;
   - absent B with existing L returns `status: refused`,
     `classification: baseline_required`, and
     `next_action: establish_baseline`, and preserves L,
     except that a verified new-page creation receipt may establish the initial
     base only when it preserves pre-create L, proves creation authorization
     and the stable identity/parent transition, and records post-create
     approval plus exact verification evidence for R; atomically promote that
     verified R as initial L/B;
   - clean L plus unchanged R returns `status: success`,
     `classification: unchanged`, and `next_action: none`;
   - semantic B/L/R equality with a remote-only metadata change that passes the
     structured-unit restriction above (only the `last_edited_time` line and
     observed revision differ) returns `status: success`,
     `classification: metadata_only`, and `next_action: none`, atomically
     refreshes the exact remote bytes and
     revision, and creates a new immutable base/receipt without invalidating
     approval, plan, code, or review;
   - clean L plus a remote structural change atomically promotes the fully
     staged/verified R tree, creates a new base/receipt, and returns
     `status: success`, `classification: structural_change`, and
     `next_action: revalidate`; it invalidates approval, plan, code, and review
     even when the content is otherwise equal;
   - clean L plus changed R atomically refreshes L/mirror, creates a new
     base/receipt, and returns `status: success`,
     `classification: remote_only`, and `next_action: revalidate` when plan,
     review, or implementation evidence exists;
   - dirty L plus unchanged R returns `status: success`,
     `classification: local_only`, and `next_action: none`, and preserves L;
   - dirty L plus a semantic or structural remote change returns
     `status: success`, `classification: materialization_conflict`, and
     `next_action: resolve_conflict`, preserves every
     canonical byte, and reports B/L/R paths and manifest differences.
   Stage and verify the complete selected tree before any atomic promotion;
   retain rollback bytes until both promoted manifests verify.
5. In `complete` mode, require a valid stage and compare B/L/R before canonical
   writes. Missing B is `status: refused`, `classification: baseline_required`,
   and `next_action: establish_baseline`; unchanged and converged content need
   no push; local-only content may proceed through its content-approval stage
   gate; remote-only or structural change is `status: success` with
   `next_action: revalidate` and no push;
   concurrent content requires an explicit three-way merge. Workers may return
   conflict packets/proposals only. The PM/user owns choices, and `Keep Both`
   requires explicit approval of the synthesized final content. Any
   `Skip` leaves that pair's local, mirror, and remote bytes untouched and
   forbids a push. A concurrent relationship at `stage=implementation` returns
   `status: success`, `classification: concurrent`, and
   `next_action: specification_reconciliation` with B/L/R evidence and proposals;
   it must not apply or push merged content at implementation stage. The source
   owner must author the selected merge, complete it through
   `stage=specification`, verification-pull it, establish a new immutable
   base/receipt, and materialize that base before any plan or implementation
   resumes.
6. Freeze each selected pair's final proposal. For
   `stage=specification`, require explicit specification approval of the exact
   final specification content. For `stage=implementation`, require the clean
   implementation review to have been performed against that exact final
   content. Any semantic edit after the gate invalidates it; a declared
   metadata-only refresh (only the `last_edited_time` line differs) does not,
   but must refresh the exact base evidence.
   Apply approved authored changes only to a staged mirror copy through
   `Skill(mdc)`.
7. Immediately before each outbound operation, use `Skill(sync-notion)` to
   re-fetch/re-diff the exact remote revision and content,
   passing the same exact `--transport-profile` file and mirror root.
   Abort and restart on any content or revision change, so the base/revision
   evidence can be refreshed. Require the pinned
   transport to prove conditional-update support and record that condition.
   If a valid profile declares it unavailable, propagate `status: refused`,
   preserve the observed B/L/R classification, set
   `next_action: provide_conditional_transport`, and leave Notion plus
   canonical L/mirror bytes unchanged. A malformed, mismatched, moved, or
   unproven profile remains `transport_unverified`. Push only a fully resolved
   pair, then perform an independent verification pull.
8. Only after verified identity/content may canonical L/mirror state advance.
   Create a new immutable base directory and receipt keyed by `<base-id>`; never
   rewrite an earlier base or receipt. A partial remote write is `partial` with
   exact recovery evidence, not success. Regenerate affected versioned specs
   under `docs/specs/<capability>/` with stable source id/revision and a
   durable task/PR/Notion receipt anchor. Use Specification's `spec-code`
   carrier, optional reference, and provenance templates:
   `README.md` is the authoritative derived contract, `reference.md` exists
   only for an intended consumer surface, and `provenance.json` remains the
   strict machine-readable sidecar. Read
   `${ESSENTIAL_ROOT}/templates/docs/docs-root-readme.template.md` and
   `${ESSENTIAL_ROOT}/templates/docs/specs-readme.template.md`, using the root
   derived from the injected state contract, then reconcile
   `docs/specs/README.md` and `docs/README.md` with the regenerated capability.
   If `reference.md` exists, verify its whole consumer surface against current
   repository-relative implementation paths: keep it
   `**Status:** 🚧 Pending` until all entries are implemented, otherwise use
   `**Status:** ✅ Implemented (<paths>, <paths>)`. Hash that final reference in its
   provenance logical unit/output. The receipt and report
   store the observed
   revision and a reference to the recorded content. The embedded
   output set in `provenance.json` excludes `provenance.json` itself; store its
   post-write reference only in work/external evidence and the report.
9. Enumerate locally registered Git worktrees and jj workspaces. For readable
   open work on the same source id whose recorded content changed, keep
   `status: success`, set `next_action: revalidate`, and return workspace/work/
   state paths; list external anchors and unknown/remote dependents separately.
   Never edit another PM's state.
10. Return every final path created or materially rewritten as
    `generated_files`. The PM runs the Essential size gate only on eligible
    work Markdown; derived `docs/**` is excluded.

<IMPORTANT>
The selected mirror is ignored, untracked transport state. It is not durable
documentation or a handoff artifact. Preserve its exact user-selected location.
</IMPORTANT>

## Verification

- B is immutable, L is the authored copy, and R came from a fresh staging pull.
- The recorded base stores stable identities, the observed revision, and the
  full accepted bytes; comparison was performed directly against those bytes.
- Existing local bytes changed only in an allowed matrix row; conflict,
  `baseline_required`, remote-only, and skipped outcomes did not push.
- The approval/review was performed against the final specification content, and
  the immediate remote recheck matched the exact comparison revision and content.
- Every successful publication has a verification pull and a new
  base/receipt keyed by `<base-id>`; no fixed `materialization.json` was overwritten.
- MDC content and Notion transport stayed with their owning skills.

## Completion

<report>

```yaml
skill: sync-spec
status: success|partial|refused|requires_ignore|transport_unverified
classification: initial|unchanged|metadata_only|local_only|remote_only|structural_change|converged|concurrent|baseline_required|materialization_conflict|invalid_evidence|not_applicable
next_action: none|revalidate|establish_baseline|resolve_conflict|specification_reconciliation|recover_partial|repair_evidence|provide_conditional_transport
mode: materialize|complete
stage: specification|implementation|null
work_id: '<id>'
transport_profile: {logical_name: '', profile_file: '<absolute destination-local path>', profile_file_sha256: '', verification: verified|transport_unverified}
outputs:
  transport_mirror: '<absolute selected path or null>'
  work_spec_root: '<absolute active-workspace path>'
  base_snapshot: '<absolute immutable path or null>'
  materialization_receipt: '<absolute base-id-keyed path or null>'
  notion_root: {id: '<32hex>', path: '<notion-sync-owned path>'}
  comparison:
    classification: initial|unchanged|metadata_only|local_only|remote_only|structural_change|converged|concurrent|baseline_required|materialization_conflict|invalid_evidence|not_applicable
    base: {revision: ''}
    local: {revision: ''}
    remote: {revision: ''}
    base_id: '<stable base identifier or empty>'
  publication: {approved: false, reviewed_spec_matches_final: false, remote_rechecked: false, required_capability: conditional_update|conditional_create|null, conditional_write: false, pushed: false, verified: false}
  reconciliation: {required: false, reason: null, conflict_packet_paths: [], invalidated: []}
  provenance: {path: '', embedded_output_paths: [], self_hash_external: ''}
  revalidation: {local_registered: [], external_receipt_anchors: [], unknown_or_remote_dependents: []}
generated_files: []
issues: []
```

</report>

Use these deterministic top-level mappings: missing base → `status: refused`,
`classification: baseline_required`, `next_action: establish_baseline`; dirty
materialization with remote semantic/structural change → `status: success`,
`classification: materialization_conflict`, `next_action: resolve_conflict`;
implementation-stage concurrent change → `status: success`,
`classification: concurrent`, `next_action: specification_reconciliation`;
remote-only semantic/structural change or a success that invalidates dependents
→ `status: success`, matching classification, `next_action: revalidate`;
ambiguous/partial remote mutation → `status: partial`,
`next_action: recover_partial`; policy/precondition failure →
`status: refused`, `classification: invalid_evidence|not_applicable`, and
`next_action: repair_evidence` when repairable.
Verified absence of the conditional capability required for publication →
`status: refused`, preserve the observed B/L/R classification, and
`next_action: provide_conditional_transport`, with no remote or canonical-local
mutation.
An absent or mismatched transport profile/mapping propagates
`transport_unverified`; missing mirror ignore coverage propagates
`requires_ignore`.
