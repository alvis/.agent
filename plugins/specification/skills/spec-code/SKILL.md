---
name: spec-code
description: Design, update, or retrospectively document a technical specification from a user-selected local, inline, or Notion source through an active work stream and versioned derived docs. Use for specification authoring; keep Notion transport in sync-notion and implementation planning in plan-code.
requirements:
  intelligence: high
argument-hint: "<instruction> --capability=<slug> [--work-id=<id>] [--source=<path-or-ref>] [--source-direction=<direction>] [--transport-root=<dir>] [--transport-profile=<absolute-file>] [--body-author=<plugin:skill>] [--template=<path-or-ref>] [--local-mdc=<path>] [--parent=<ref>] [--type=api|web-app|mobile|library|fullstack]"
---

# Spec Code

Author a technical specification as one coherent contract. An explicit local
path or selected Notion identity can be an authoritative source. Inline prompt
text is requirements evidence, not by itself a durable final contract: it must
first become an approved work-local candidate and then a reachable versioned
carrier. When the selected source is Notion, its transport pairing remains
authoritative; versioned `docs/specs/<capability>/*.md` is a reviewed derivation
for engineers.

## Boundaries

- Use for CREATE, UPDATE, and DOCUMENT modes. Do not implement code or own
  Notion transport/conflicts.
- Never create independent root specification/design/requirement artifacts.
  Temporary reasoning belongs in the active work's `design/`, `proposals/`,
  `changes/`, or `decisions/`; durable specification docs belong under
  `docs/specs/<capability>/` only after verified completion.
- This marketplace owns the MDC body grammar through `specification:mdc`.
  Before creating or semantically changing an MDC body, require the explicit
  `--body-author=specification:mdc` selector and invoke that exact capability.
  For another Notion body dialect, require an explicit
  `--body-author=<plugin:skill>`, validate its canonical capability identity,
  and invoke that exact installed capability. Use
  `specification:sync-spec` only for a selected existing Notion specification's
  work-local materialization or verified completion; local and inline sources
  do not detour through it. For a Notion source, the work-local materialization
  is the authored copy; the selected mirror is transport state, not an editing
  surface. Retain its immutable base receipt, exact recorded bytes,
  and observed revision.
- Detect specification changes by comparing content directly (byte-for-byte, or
  via `git diff`), disregarding only the volatile Notion `last_edited_time` line
  for semantic equality. Approvals bind to the approved specification content;
  the observed revision is only a lightweight change signal.
- Preserve transport-owned paths. An existing path comes from transport; a new
  unsynced path must be explicitly supplied. Never infer one from title or id.
- `--skip-notion-sync` controls Notion transport only. It never suppresses the
  required local/inline approval and durable-promotion path.

## Inputs

- **Required**: instruction and lowercase `--capability=<slug>`.
- **Optional**: work id, authoritative source/location/direction, explicit
  transport root, absolute destination-local transport profile file, exact
  selected body-author capability for Notion body mutation, live template
  path/ref, explicit local transport path and parent for CREATE, project
  type, `--reference=<doc>`, `--discovery=<path>`, `--sync-template`, and
  `--skip-notion-sync`.
- **Prerequisites**: active local state. Notion credentials/tooling
  are required only when the selected direction uses Notion transport.

<IMPORTANT>
Coherence mandate: UPDATE and DOCUMENT edits must be integrated into their
owning sections. Never append an addendum, revisions trailer, parallel old/new
section, or copied transport history.
</IMPORTANT>

## Workflow

1. Before creating or materially rewriting a project artifact, read the
   absolute `state.md` path injected by Essential. If unavailable,
   stop artifact writes and report the missing contract. For a direct run, run
   Essential's workspace resolver with `--work-id` only for an explicit user
   override and accept its deterministic environment, Git-branch/jj-workspace,
   or sole-existing-work match. Ask only when it returns `work_id_required`,
   using its returned candidates; any new id follows that user-confirmed choice.
   A delegated run receives the explicit id/root. Read only the exact
   work/source pointers required for this specification.
2. Resolve source kind, location, and direction from the explicit request
   first, then active work state. A local source requires its exact explicit
   path; never infer or silently relocate it. Treat inline prompt text only as
   requirements evidence. Its eventual authoritative source is the durable
   carrier produced in Step 6, not the prompt or conversation transcript. For
   an existing Notion source that needs local materialization, invoke
   `Skill(sync-spec)` with the explicit transport root plus
   `--transport-profile=<absolute-file>` and preserve its returned `ref:`
   identities, paths, and receipt. Resolve that file from the explicit option
   or an active-state mapping containing its destination-local absolute path,
   logical name, and last verified exact-byte SHA-256. The child revalidates it;
   never infer a path from the profile name/root or reuse an origin path. Select
   CREATE when no authoritative
   specification exists, UPDATE when one exists, and DOCUMENT when current code
   must be described without inventing requirements. Load
   [references/document-mode.md](references/document-mode.md) only for DOCUMENT.
   When this run may create or semantically change a Notion body, resolve
   `--body-author` once from the explicit argument. Require the canonical
   `<plugin>:<skill>` form, record `selection_source: explicit_argument`, and
   pass the identical value to every nested `sync-spec`/`sync-notion` call. Do
   not infer it from the file extension, transport profile, repository, or
   installed plugins. Compare every candidate, source, and promoted carrier by direct content
   comparison (disregarding only the volatile `last_edited_time` line for
   semantic equality).
3. Acquire and read the complete canonical template before drafting. Use an
   explicit `--template`, then a template recorded in active work/project
   configuration. A Notion-backed source must use the selected **live** Notion
   template through its configured transport; if it cannot be resolved, ask or
   refuse, and never substitute a bundled snapshot. Only for local or inline
   work with neither an explicit nor project template, use the immutable
   source-kind-neutral fallback
   [assets/capability-readme.template.md](assets/capability-readme.template.md).
   Record that fallback with portable locator
   `plugin:specification/spec-code/assets/capability-readme.template.md`, the
   exact installed Specification plugin version, and asset SHA-256; never
   publish its machine-local install path. Record the primary carrier
   template's portable locator and exact SHA-256 so retries choose the same
   bytes. The singular v1 provenance `template` object remains that primary
   carrier identity; the Specification plugin version prescribes the optional
   reference template, whose derived file is hashed as an output. Preserve
   required section order and properties, and make
   `--sync-template` an explicit content-preserving migration against this
   snapshot. Then gather requirements, discovery
   evidence, architecture, API/data contracts,
   UI behavior, security/privacy posture, acceptance criteria, and unresolved
   decisions. Preserve evidence provenance. Route underexplored material
   unknowns to `essential:discover` and grounded alternatives to
   `essential:decide`; do not turn assumptions into requirements. For inline
   evidence, materialize the complete authored contract—not a summary or
   pointer to the conversation—at the deterministic work-local candidate
   `<work-root>/design/<capability>-specification-candidate.md`. Compute the
   candidate's exact byte SHA-256 for its inline identity locator, and record its
   exact bytes for later direct comparison.
   Require explicit approval of the candidate content; any semantic edit to the
   candidate invalidates approval, while a metadata-only byte change still
   requires a fresh receipt.
4. Create or update the work-local design/proposal/decision children needed to
   explain the specification change. Use lowercase deterministic child names
   and the status schema in the Essential contract. Return an index
   reconciliation request to the PM; do not edit PM-owned overview files.
5. Prepare source and durable derivation metadata according to
   [references/frontmatter.md](references/frontmatter.md). For an existing
   Notion pair, modify only its exact transport-returned path through the
   capability bound as `body_author`.
   For CREATE or DOCUMENT with no existing page and Notion sync requested,
   require explicit `--local-mdc`, `--parent`, and `--body-author`; first author
   that local file through the bound capability using the live template and
   parent metadata. Pass only the approved body and exact path; the authoring
   capability cannot choose identity, path, transport, or authority. Creation
   injects stable semantic `ref` identity and may remove creation-only `parent`,
   so pre-create content cannot be final specification approval. Obtain explicit
   **creation authorization** bound to the candidate
   content, parent, and exact diff scope. Only then invoke
   `Skill(sync-notion)` in local-to-Notion mode with the exact transport root,
   `--transport-profile=<absolute-file>`, and the identical
   `--body-author=<plugin:skill>`. Verification-pull the new stable
   `ref:`, preserve pre-create bytes, and present every transport-created stable
   metadata/content difference. Record verified R and obtain final specification
   approval of its post-create content. The creation receipt
   stores both the pre- and post-create content references, authorized
   transition/diff, returned identity/revision,
   and exact verification evidence, including the body-author capability and
   `selection_source`. Invoke `Skill(sync-spec)` materialization with that
   receipt, profile, and identical body-author value to atomically establish verified R as initial
   L/B. Never pretend pre/post-create content matches, exclude stable `ref` as
   volatile, or establish a base without post-create approval.
   Never ask transport to create a page before the local MDC exists. For an
   explicit local source, use a `repo:` identity when reachable
   and a `local-approved:sha256:` exact-byte identity locator otherwise; require
   approval of its content before derivation and retain the
   explicit path only in ignored work evidence when it is not portable. For
   inline evidence, use only the approved deterministic candidate from Step 3.
6. For every approved local or inline contract, regardless of
   `--skip-notion-sync`, perform a content-preserving promotion into the
   versioned `docs/specs/<capability>/` tree. The reachable authoritative entry
   for `plan-code` and `implement-code` is
   `docs/specs/<capability>/README.md`; write the durable machine-readable
   provenance receipt at `docs/specs/<capability>/provenance.json`. The receipt
   records source kind, durable source locator, source and carrier content
   references, the approved specification content, every
   durable **contract** output path/exact SHA-256, logical-unit mapping, template
   identity, and the content-equivalence check. Its embedded
   output set excludes `provenance.json` itself. Compute the completed
   provenance file's own exact SHA-256 after writing and store it only in
   ignored work evidence, an external durable anchor, and this run's report;
   never insert a self-hash into the file. Record a repository-relative explicit
   local path only when it is itself reachable/versioned; never embed the
   expiring ignored inline-candidate path in versioned documentation. Keep that
   exact candidate path/identity in active work and return it in this run's output.
   Compare the promoted carrier against the source directly while retaining source
   logical-unit ids and lineage. Require its content to equal the
   approved specification content. If
   promotion changes semantic contract content, stop `ready_for_approval` and
   approve the new content before retrying. Record the durable entry path,
   receipt path, and the approved/carrier content references in active-work
   reconciliation so later skills never depend on the
   prompt transcript or ignored candidate alone. Do not claim a Notion round
   trip for this path. Read
   `${ESSENTIAL_ROOT}/templates/docs/docs-root-readme.template.md` and
   `${ESSENTIAL_ROOT}/templates/docs/specs-readme.template.md`, using the root
   derived from the injected state contract, then reconcile
   `docs/specs/README.md` and `docs/README.md` so the capability remains
   reachable and its contract status is explicit.

   Authority is singular after promotion. A reachable `repo:` local source
   remains authoritative and `docs/specs/<capability>/` is its checked
   derivation; later planning/implementation must rehash both and return
   `ready_for_specification` when the source, provenance, and carrier do not
   match. For a non-reachable `local-approved:` source, the approved durable
   carrier becomes authoritative after content-equivalence verification; the
   original hash is historical provenance, not a second live source. Inline
   work likewise uses its approved durable carrier after promotion.

   The capability `README.md` is the approved normative contract and begins
   with reader orientation: what the capability is, when to use it, how it
   works, and overall usage direction. Do not add installation instructions.
   When the contract defines an intended consumer surface — including one
   intended for another package in the same repository — also derive
   `reference.md` from
   [assets/reference.template.md](assets/reference.template.md). Group entries
   logically and document each API's description, parameters, returns,
   throws or rejections, side effects, and a minimal example. Put `## Overview`
   first, followed immediately by `**Status:** 🚧 Pending` while the referenced
   surface is not fully implemented, or
   `**Status:** ✅ Implemented (<paths>, <paths>)` once every implementation path is
   verified. Do not publish private helpers, and do
   not add completeness, verification-owner, compatibility/versioning, or type
   signature sections. Use
   [assets/provenance.template.json](assets/provenance.template.json) for the
   machine-readable receipt shape. When `reference.md` exists, include its
   logical-unit mapping and exact hash in provenance; remove the template's
   conditional reference entries when it does not.

   For a selected Notion source, `--skip-notion-sync` leaves authored Notion
   content temporary and does not claim promotion. Otherwise invoke
   `Skill(sync-spec)` with the same exact transport profile in
   `complete --stage=specification` mode only after the PM has persisted the
   immutable materialization receipt and content-bound specification approval. If
   the current specification content differs from the approved content, return
   `ready_for_approval`; never publish it under an earlier approval. If this run
   cannot establish that precondition,
   return `ready_for_completion` with the exact reconciliation payload instead
   of claiming completion. The completion flow uses the selected transport
   mirror, verification pull, derived `docs/specs/<capability>/`, durable receipt,
   and dependent revalidation results. Claim completion only for operational
   `status: success` with `next_action: none`; propagate `remote_only` or
   `structural_change` plus `next_action: revalidate`, and never treat
   unchanged content alone as permission to ignore structural change.
7. Verify the resulting derived spec reads as one contract, `README.md` points
   to all versioned children, and provenance matches the verification pull.
   Confirm the provenance output set excludes itself and its post-write exact
   hash exists only in work/external evidence and this run's report.
8. Return explicit final paths generated or materially rewritten as
`generated_files`, including work-local `.md` children and derived docs.
Do not run file sizing; after all writers return, the PM checks only eligible
work Markdown inside the target `.state/`. Derived `docs/**` has no
mechanical size limit, but it is still length-calibrated — see
`essential:references/output-manifest.md`.

## Verification

- The authoritative contract follows the verified live template with no
  invented or duplicate sections.
- Every authored Notion body change used the one explicitly selected
  `body_author`; nested calls and receipts retained the exact capability and
  selection source, plus Notion identity/path.
- A completed Notion run has verified sync, verification pull, derivation
  provenance, `README.md`, and revalidation results. A skipped Notion sync
  remains explicitly temporary. A local/inline run always has a versioned
  carrier plus durable receipt and never claims a remote round trip.
- Raw inline prompt text is never reported as the authoritative final contract;
  its approved candidate content and the reachable durable carrier
  match through the content-equivalence check, compared directly.
- `generated_files` is complete and overview reconciliation is assigned to the
  PM.
- The recorded specification approval is bound to the exact specification
  content that was completed; a later semantic edit requires approval
  again. The observed revision remains recorded with it in every receipt.

## Completion

Report mode, work id, capability, authoritative source/location/direction,
template snapshot, Notion refs, selected body-author capability/selection
source, and validated transport profile
path/exact-byte SHA when applicable, work artifacts,
`ready_for_completion` or sync/verification result, derived specification paths
and provenance receipt, the exact `authoritative_spec_path`,
the approved specification content reference, source/carrier content references,
external `provenance_file_hash`, and durable carrier/output SHA-256 values, revalidation
impact, PM updates requested, and `generated_files`.
