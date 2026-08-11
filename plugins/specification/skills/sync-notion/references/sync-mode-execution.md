# Sync mode execution

Choose exactly one branch per declared pair. Use only the selected transport
profile's conformance-validated capability vectors and output contracts; never
invent commands or flags. Recursive operations invoke the validated
`recursive_pull` vector once, and every returned relative path is preserved.

## `local-to-notion`

1. Pull the current remote page into unique staging with the validated
   recursive-pull vector/output contract and record stable identity,
   revision/hash, and recursive coverage. For `CREATE_NEW`, use the validated
   search output to prove no acceptable ref exists and validate explicit
   `parent:` instead; a failed or ambiguous search is not absence.
2. Compute and present a structured local-versus-fresh-remote diff. Freeze the
   reviewed local hash; a changed local file invalidates the review. Do not
   push merely because the direction says local-to-Notion.
3. Require the caller's exact-hash approval gate. For an existing page,
   immediately re-fetch/re-diff remote state and abort/restart if its identity,
   revision, or hash differs from Step 1. Use only the independently proven
   `conditional_update` vector.

   For `CREATE_NEW`, repeat the validated absence/parent checks. Use only an
   independently proven `conditional_create` vector with the stable creation
   key; conditional-update support is irrelevant.

   If the verified profile declares the operation's conditional capability
   `unavailable`, return `status: refused`, preserve the already observed B/L/R
   `classification`, set `next_action: provide_conditional_transport`, and
   perform no remote or canonical-local mutation. An invalid or mismatched
   profile instead remains `transport_unverified`. Approval or another read
   cannot substitute for the missing atomic precondition.
   For a selected set, complete this capability preflight for every pair before
   invoking any mutation; one unavailable requirement refuses the whole set
   without hiding the per-pair classifications.
4. Invoke the frozen `conditional_update` vector exactly once for a fully
   approved existing pair (or one separately conformance-proven atomic
   recursive conditional update for its frozen selected set). Invoke the
   frozen `conditional_create` vector exactly once for `CREATE_NEW`, using the
   staged candidate rather than the canonical authored file. Never invoke an
   unguarded core push/create vector separately. Require the conformance-bound
   output contract and read the new canonical `ref` only from validated create
   output; never predict it or assume push performs creation.
5. Independently pull to verification staging and require exact expected
   identity/body/relationships. Only then may the caller advance canonical
   transport/base receipts.

## `notion-to-local`

1. Pull once into a unique sibling staging directory with the selected
   profile's validated `recursive_pull` vector and output contract.
2. Verify the requested root by `ref:`, returned relationships, completeness,
   path containment, metadata, and content manifests. Specification transport
   must remain `.mdc`.
3. If the caller requested staging-only, return R and its manifest without
   changing the declared local root. Otherwise require the caller's base/local
   decision to permit replacement, retain rollback bytes, atomically promote
   the complete staged set, verify it, and restore rollback on failure.

## `two-way-merge`

1. Accept only a fully resolved staged proposal from
   `two-way-merge.md`, including B/L/R evidence, the approved synthesis content
   bound to its `final_proposal` revision, and stage-specific approval/review for
   that exact content, confirmed by direct comparison — not a removed digest.
2. If any conflict is skipped, unresolved, failed, or changed after approval,
   return `partial` and do not edit canonical local/mirror bytes or push. Never
   insert a TODO as a merge substitute.
3. Apply an approved `.mdc` proposal only through the exact capability bound as
   `body_author`, in a staged transport copy. Require the selector to match the
   caller and receipt, pass only the approved body and exact path, then re-verify
   it against the approved synthesis by direct content comparison.
4. Re-fetch/re-diff the remote revision immediately before push. Abort/restart
   on change and require proven conditional-update support. Merge never creates
   a page, so conditional-create evidence is not a substitute here. If
   conditional update is unavailable, return the fail-closed refusal described
   above without applying the staged proposal to canonical local state.
5. Push once, verification-pull, and require exact merged identity/body before
   canonical promotion or a new receipt.

For every branch, retry is allowed only when evidence proves the failed attempt
made no remote mutation. A possible, unknown, or partial remote write stops
`partial` with exact recovery evidence and requires a fresh reconciliation;
never retry from ambiguous remote state. Never label a multi-page operation
atomic unless the pinned transport actually proves that guarantee.
