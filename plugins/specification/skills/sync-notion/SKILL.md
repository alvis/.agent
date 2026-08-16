---
name: sync-notion
description: Synchronize paired local files and Notion pages in a declared direction, validate opaque transport identity metadata, and coordinate guarded conflict resolution. Own transport and pairing; require an explicitly selected body-author capability before semantic body creation or change.
requirements:
  intelligence: medium
argument-hint: "<validate-metadata|local-to-notion|notion-to-local|two-way-merge> <file-or-ref> [counterpart...] [--transport-profile=<absolute-file>] [--body-author=<plugin:skill>] [--transport-root=<dir>] [--out=<dir>]"
---

# Sync Notion

Own transport, pairing, conflict packets, and post-sync integrity for declared
local–Notion pairs. Public modes are `validate-metadata`, `local-to-notion`,
`notion-to-local`, and `two-way-merge`; CLI verbs are implementation details.

## Boundaries

- `specification:sync-spec` orchestrates engineering-specification bases,
  work-local copies, derivation, and revalidation. This skill transports only
  the exact declared pair/set.
- For state-managed work, use an explicit destination-local transport root or
  the exact path from a validated destination-local pairing receipt. A portable
  handover contributes only a logical profile and optional relative suggestion,
  never a selected root. Never invent a mirror location or filename from a
  workspace, title, or id.
- Notion transport bodies are opaque here. `specification:mdc` owns the MDC
  grammar and authors semantic MDC bodies; another body dialect requires the
  exact capability supplied as `--body-author=<plugin:skill>`. `notion-sync`
  may update transport metadata but never interprets body grammar.
- `validate-metadata` is read-only, interprets only frontmatter identity keys,
  and never loads a transport profile, reads `NOTION_TOKEN`, or inspects body
  syntax.
- A cached mirror is not proof of current Notion state. Every outbound decision
  compares against a fresh staging pull.

## Inputs

- **Required**: one public mode and at least one local path or Notion ref.
- **Optional**: exact counterpart/output root/database id, immutable base
  receipt, expected remote revision/hash, and caller-confirmed final hash.
- **Required before semantic body mutation**: one explicit canonical
  `--body-author=<plugin:skill>` matching
  `^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$`. Require it for new-page creation,
  outbound authored changes, and an applied two-way resolution. Resolve it
  once, record `selection_source: explicit_argument|delegated_caller`, and pass
  that identical value through the operation chain. Never infer a default from
  the transport name, file extension, installed marketplaces, or repository.
  Byte-preserving pull/materialize/read and `validate-metadata` may omit it.
- **Required for mutation**: one exact destination-local shared
  transport/mirror root, supplied explicitly or resolved from a validated
  destination-local pairing receipt. A staging or evidence directory is not a
  transport root and cannot choose lock scope. An origin-workspace absolute
  path or an unverified suggested path is not an input.
- **Required for every remote operation**: a destination/team-owned transport
  profile naming the installation source, package/distribution, exact version,
  canonical executable path, executable SHA-256, help-output fingerprint,
  checksum-bound conformance evidence, and exact capability/flag mapping for
  recursive pull, search, create, push, conditional update, and conditional
  create (or an explicit verified absence for either conditional operation).
  A handover's logical profile name selects destination
  configuration; it never supplies executable trust data from the origin.
  The caller supplies the selected file explicitly as
  `--transport-profile=<absolute-file>`; its strict schema and safety rules are
  [references/transport-profile.md](references/transport-profile.md). There is
  no default profile location or logical-name-to-path guess.
- **Prerequisites**: `NOTION_TOKEN` and the injected Essential contract for
  remote operations and project artifact writes. Neither is required by
  `validate-metadata`. This plugin does not claim or install a bundled,
  supported `notion-sync` distribution.

## Workflow

1. For `validate-metadata`, require one or more regular, non-symlink `.mdc`
   paths and invoke `scripts/validate-transport-metadata.sh` once for the exact
   set. Return its identity values or a refusal without changing bytes. Do not
   interpret indentation, annotations, markers, or any other body syntax; skip
   the remaining remote workflow.

   For all other modes, read the injected absolute `state.md` before project artifact
   writes. If unavailable, stop artifact writes and report the missing
   contract. Resolve work/transport paths only from explicit arguments, active
   state, or an immutable receipt. Require actual write targets to be ignored
   and untracked in their owning VCS workspace; otherwise return
   `requires_ignore` with its exact ignore file. Refuse unmanaged roots.

   Before any transport content/query/mutation command, require the explicit
   absolute `--transport-profile` file and validate the complete strict v1
   contract in
   [references/transport-profile.md](references/transport-profile.md). Reject
   a missing/unsafe file, duplicate or unknown field, secret-bearing content,
   missing field, relative or PATH-only executable, symlink/non-regular
   executable, unknown capability, or placeholder as `transport_unverified`.
   The profile contains no token; read `NOTION_TOKEN` only from the invocation
   environment and never copy it into evidence or reports. Run the bundled
   dependency-free `scripts/validate-transport-profile.py` with `python3` and
   require its `profile_structure_verified` report; it canonicalizes the
   fixed-shape conformance evidence, hashes the exact profile and
   executable bytes, and never runs the executable. Then run only the returned
   canonical executable's inert
   version/help probes, require the exact configured version and help-output
   fingerprint, and prove every configured command/flag token is present.
   Require the profile's conformance receipt to bind the same executable hash,
   version, help fingerprint, every exact canonical command/flag vector and
   output contract, and recursive/search/create/push outcomes; help-text
   presence alone is not proof of runtime semantics. Require the conformance
   vectors and output contracts to equal the selected profile mappings exactly.
   Record conditional update and atomic conditional create independently with
   their positively tested precondition flags; verified support for one never
   proves the other. A verified absence still permits read-only transport, but
   it cannot authorize the corresponding remote mutation. Do not search
   `PATH`, substitute another binary, install/upgrade a package, or use any
   remote command after a mismatch. Every missing, mismatched, or unprovable
   profile returns the same deterministic `transport_unverified` refusal with
   no Notion or canonical local write.

   Resolve any supplied `--body-author` once before classification. Validate
   only the canonical capability identifier, never execute it as shell/path
   text, and retain its exact value plus selection source separately from the
   transport profile. Before any operation that may create or semantically
   change body bytes, require it to match the value in the caller's receipt or
   delegated input. A missing or changed value returns `status: refused` and
   `next_action: select_body_author`; do not report `transport_unverified`,
   which remains reserved for executable/profile trust failures. Invoke the
   selected capability only with the already approved staged body and exact
   path; it cannot select paths, refs, transport, or authority.

   Immediately before **every** executable invocation—including version/help
   probes, search/pull/create, pre-push rechecks, push, and verification
   pulls—reinspect the canonical path as a non-symlink regular file and
   recompute its SHA-256 against the same exact profile bytes. Never rely on the
   run's first fingerprint after a package upgrade or replacement could occur.
   A pre-mutation mismatch returns `transport_unverified`; a mismatch after a
   possible or confirmed remote mutation stops all later commands and returns
   `partial` with the last verified fingerprint and recovery evidence.
2. Resolve each pair as `{local_path, notion_ref, base_evidence, state}`. Prefer
   frontmatter `ref:`, then explicit ref, then the validated profile's search
   capability and `notion-search-json-v1` output contract; load
   [references/database-resolution.md](references/database-resolution.md) only
   for database/search ambiguity. Reject ambiguous identity or any path outside
   the declared root. Never infer a missing root from a title, page id,
   workspace label, evidence directory, conventional `.state/notion/`
   path, or another machine's receipt.

   Before using or creating the declared transport root, locate its deepest
   existing ancestor, reject every symlink or non-directory in that path, and
   use VCS discovery from that ancestor to establish the exact owning checkout.
   Require the proposed root to be lexically and canonically contained in that
   checkout and require effective ignore coverage for both a probe below the
   proposed root and its future `.sync-locks/` child. Require both hypothetical
   paths to be untracked. If ownership is absent or ambiguous, a parent is
   unsafe, containment fails, or ignore coverage is missing, return
   `requires_ignore`/`refused` without creating anything.

   An absent declared transport root or `.sync-locks/` may be created only
   after those ownership, containment, ignore, untracked, and safe-parent gates
   pass. Create each missing directory component with an atomic no-clobber
   operation; after every attempted creation, inspect that exact component as
   a real directory, reject symlinks, canonicalize from the owning checkout,
   and revalidate containment and ignore state. A component that appeared
   concurrently is accepted only if it passes the same checks and is reported
   as pre-existing, never as this run's creation. On any failure, stop before
   lease acquisition and report every directory this run created; do not
   remove or replace a concurrently owned component. Canonicalize the final
   declared transport root without crossing symlinks and require its
   `.sync-locks/` directory to be ignored and untracked. Reject a symlinked
   lock component, a lock path escaping that root, or an arbitrary
   evidence/staging directory used as lock scope.

   Normalize an existing page to the canonical lowercase Notion page UUID
   returned by transport. For `CREATE_NEW`, normalize the stable creation key
   `create:<canonical-parent-ref>:<declared-root-relative-local-path>`. Derive
   exactly one lease path as
   `<transport-root>/.sync-locks/<sha256(normalized-ref)>.lease/`; every
   participating client for that transport root therefore contends on the same
   path for the pair. Acquire it with an atomic no-clobber directory creation,
   then durably record the normalized ref, owner, process/session identity,
   cryptographically unguessable token, `created_at`, and `heartbeat_at`.
   Refresh a heartbeat only after comparing the on-disk token with this run's
   token. If metadata publication fails after directory creation, leave the
   directory contended for explicit recovery rather than guessing ownership.

   On every owned exit, release only after final evidence is durable and a
   fresh compare confirms the on-disk token still equals this run's token. Any
   existing lease, including a stale-looking or metadata-incomplete lease,
   returns `concurrent_sync` with owner-resolution evidence instead of
   auto-deletion or racing publication. Stale recovery requires proving the
   recorded owner/session ended, a fresh read-only remote pull to classify any
   interrupted write, and an explicit recovery decision. Archive/replace only
   if a final compare still matches the observed old token; never silently
   delete a lease, reuse its token, or let one owner's cleanup remove another
   owner's lease.

   This lease serializes only participating clients that share the exact same
   transport root. It is not a cross-machine Notion lock. Cross-client
   publication still requires the independently proven conditional update or
   conditional create matching that operation. A local lease, user approval,
   repeated read, or timing assumption is never a substitute.
3. For every existing outbound/merge pair, pull the remote page recursively
   into a unique staging directory before computing a decision. For explicit
   `CREATE_NEW`, verify absence of `ref:`, validate the declared parent, and
   use only the validated create capability/output contract instead. Preserve
   returned paths, refs, parents, relationships, revision
   evidence, and bytes. For specification transport, require `.mdc`. Record the
   compared remote revision/hash (or new-page absence evidence) and the exact
   final local hash.
4. Execute one branch from
   [references/sync-mode-execution.md](references/sync-mode-execution.md):
   - `local-to-notion` reviews a fresh diff and stages a push candidate;
   - `notion-to-local` verifies staging before atomic local promotion;
   - `two-way-merge` loads
     [references/two-way-merge.md](references/two-way-merge.md) and produces an
     explicit base/local/remote proposal before any canonical write; applying
     that proposal requires the previously bound `body_author`.
   Workers compute diffs/conflict packets/proposals only. The coordinator asks
   the user and records decisions. `Keep Both` requires explicit approval of
   the synthesized final hash. `Skip` leaves that pair unchanged and forbids
   TODO insertion or push.
5. Treat each selected pair as one decision unit: freeze and validate the whole
   proposal before canonical local mutation or outbound push. An unresolved,
   skipped, failed, identity-shifted, or hash-shifted pair stops unchanged. Do
   not let success on one pair disguise a failed or partial result on another.
6. Before any remote mutation, require the verified profile to prove the
   conditional capability for that exact operation. For a multi-pair outbound
   run, preflight the required capability for every selected pair before the
   first remote or canonical-local mutation; one unavailable requirement
   refuses the whole selected mutation set while retaining every observed
   classification. For an existing-page
   update, require `conditional_update`, then immediately re-fetch/re-diff the
   remote revision/hash, require it to equal the value compared in Step 3, and
   freeze that exact conditional vector with the compared revision.

   For `CREATE_NEW`, independently require `conditional_create`, then re-run
   the validated search/absence and parent checks immediately before freezing
   the exact create-if-absent vector with the stable creation key. Conditional
   update support never suppresses this creation gate. Abort/restart either
   branch on a changed precondition.

   If the profile validly declares the required capability `unavailable`, make
   no remote or canonical-local mutation. Return `status: refused`, preserve
   the already observed B/L/R `classification`, and set
   `next_action: provide_conditional_transport`. This is distinct from
   `transport_unverified`, which remains reserved for a malformed, mismatched,
   moved, or unproven profile. User acknowledgement cannot override either
   refusal.
7. Perform exactly one remote mutation: invoke the frozen
   `conditional_update` vector (the validated core `push` vector plus its
   proven revision-precondition flags) for an update, or the frozen
   `conditional_create` vector (the validated core `create` vector plus its
   proven create-if-absent flags and stable key) for `CREATE_NEW`. Never invoke
   the unguarded core vector separately. Creation receives only the frozen
   staged candidate, never the canonical authored file. Then
   independently verification-pull each
   affected pair. Require stable identity, intact `ref:`/`parent:` metadata,
   recursive coverage, and exact expected body. Retry only when transport
   evidence proves the failed attempt made no remote mutation, and repeat the
   complete pre-push gate. After a possible, unknown, or partial remote
   mutation, stop `partial`, preserve recovery evidence, and require fresh
   reconciliation; never retry from an ambiguous remote state. A zero exit does
   not override failed integrity.
8. Promote staged local bytes only after their required verification. On a
   data-loss or partial-remote-write signal, stop later pairs, preserve recovery
   evidence/corrected content, and report `partial`; never claim atomic success
   the transport did not prove.
9. Return every final path created or materially rewritten as
   `generated_files`. The PM applies the Essential size gate only to eligible
   work Markdown.

<IMPORTANT>
Only `sync-spec` may complete a specification across work copy, selected
mirror, Notion, and durable derived docs. This skill does not promote docs,
edit PM-owned state, or mark dependents for revalidation.
</IMPORTANT>

## Verification

- The destination/team transport profile's canonical executable path, exact
  version, executable SHA-256, help fingerprint, and required command/flag
  vectors/output contracts were conformance-bound before any remote operation;
  failures returned `transport_unverified` without a content command or write.
- Every executable invocation has an immediately preceding matching path/type/
  SHA fingerprint; drift after possible mutation stopped `partial` rather than
  executing another version of the transport.
- Each outbound decision used fresh remote bytes and recorded the compared and
  immediately rechecked revisions/hashes.
- Existing-page updates used independently proven conditional-update
  protection. Creation used the validated create command plus independently
  proven conditional-create protection. An unavailable required capability
  refused before any remote or canonical-local mutation.
- Every successful pair has exact identity/content verification. A skipped or
  unresolved pair changed neither canonical local bytes nor remote content.
- Every semantic body creation/change used the one explicitly selected
  `body_author`; nested callers and receipts matched it exactly. Missing or
  changed policy refused with `select_body_author`, separately from transport
  verification.
- No worker made an interactive choice, no `Keep Both` synthesis bypassed
  approval, and no skipped conflict became a TODO or push.
- Paths came from explicit input or transport output, and write roots were
  ignored/untracked.
- Any missing transport/lock directories were created only after exact VCS
  ownership, safe-parent, containment, ignore, and untracked gates; each
  no-clobber component was revalidated and reported.
- Each mutating pair used the deterministic shared-transport lease, all
  heartbeat/release operations matched its token, and a contended lease caused
  no canonical or remote write.

## Completion

<report>

`validate-metadata` returns only `status`, `mode`, exact `paths`, reported
transport identities/revisions, `bytes_changed: false`, and `unresolved`; the
remote transport report below is not applicable.

```yaml
status: success|partial|failure|refused|requires_ignore|concurrent_sync|transport_unverified
classification: initial|created|updated|pulled|unchanged|metadata_only|local_only|remote_only|structural_change|converged|concurrent|baseline_required|materialization_conflict|invalid_evidence|resolved|skipped|mixed|not_applicable
next_action: none|revalidate|establish_baseline|resolve_conflict|specification_reconciliation|recover_partial|verify_owner|provide_conditional_transport|select_body_author
mode: validate-metadata|local-to-notion|notion-to-local|two-way-merge
body_author: {capability_id: '<plugin>:<skill>|null', selection_source: explicit_argument|delegated_caller|null, verification: matched|not_required|refused}
ignore_file: '<absolute owning-workspace path or null>'
transport:
  profile: '<destination/team logical profile>'
  profile_schema: notion-sync-transport-profile/v1
  profile_file: '<validated destination-local absolute path>'
  profile_file_sha256: ''
  installation_source: ''
  package: ''
  executable: '<canonical absolute path>'
  expected_version: ''
  actual_version: ''
  expected_version_stdout_sha256: ''
  actual_version_stdout_sha256: ''
  expected_sha256: ''
  actual_sha256: ''
  expected_help_sha256: ''
  actual_help_sha256: ''
  conformance_evidence_sha256: ''
  capabilities: {recursive_pull: '', search: '', create: '', push: '', conditional_update: '', conditional_create: ''}
  verification: verified|transport_unverified
  invocation_fingerprints: [{phase: '', profile_file_sha256: '', executable_sha256: '', verified_at: ''}]
pairs:
  - local_path: ''
    notion_ref: ''
    classification: initial|created|updated|pulled|unchanged|metadata_only|local_only|remote_only|structural_change|converged|concurrent|baseline_required|materialization_conflict|invalid_evidence|resolved|skipped|not_applicable
    next_action: none|revalidate|establish_baseline|resolve_conflict|specification_reconciliation|recover_partial|provide_conditional_transport|select_body_author
    lease:
      path: '<transport-root>/.sync-locks/<sha256>.lease/'
      normalized_ref: ''
      owner: ''
      session: ''
      token_fingerprint: ''
      created_at: ''
      heartbeat_at: ''
      outcome: acquired|released|contended|recovered|not_required
    action: created|updated|pulled|merged|unchanged|skipped
    hashes: {base: '', local_final: '', remote_compared: '', remote_pre_push: ''}
    conflicts: {found: 0, resolved: 0, skipped: 0}
    gate: {final_hash_approved: false, required_capability: conditional_update|conditional_create|null, conditional_update: false, conditional_create: false}
    post_sync_diff: clean|unexpected|not_run
    metadata_verified: true|false
generated_files: []
created_directories: []
commands: []
unresolved: []
```

For one pair, top-level classification/next action equal that pair. For several
pairs, use the shared value only when all agree; otherwise use
`classification: mixed`, retain every pair's classification/next action, and
choose the strongest safe top-level next action. A partial/failing pair still
controls operational status and cannot be hidden by successful pairs.
For a missing conditional capability, retain the relationship classification
already derived from B/L/R; never replace it with the intended write action
(`created` or `updated`) because no write occurred.

</report>
