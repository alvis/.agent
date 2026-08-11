# Notion URL & Database-ID Resolution

Load this reference during pair resolution whenever a file-page pair lacks a
`ref:`. It documents the thin search/create substitutions over `notion-sync`.

If every pair already has a known `notion_url`, you can ignore this reference.

## Resolve Notion identity

Use only the canonical executable and normalized `search` capability returned
by the validated transport profile. Construct argv without a shell as
`[executable, command, ...flags, search_hint]`; never use `PATH`, a literal
`notion-sync` command, or an undeclared limit/JSON flag. Recheck the executable
fingerprint immediately before invocation.

Require the conformance-bound `notion-search-json-v1` output: one JSON object
whose candidates each contain canonical `ref`, `parent`, and `title` fields.
Reject unknown/malformed output rather than guessing its schema. Search does
not select a winner. The coordinator compares the explicit hint and optional
`database_id`, accepts one unambiguous identity, or asks the user. Fuzzy or
partial title similarity alone never authorizes pairing.

If the validated search returns no acceptable match, mark the pair
`CREATE_NEW` for the guarded creation branch. Search failure, malformed output,
or ambiguity is not absence and must not create a page.

## CREATE_NEW Fallback (no existing page)

When a pair is marked `CREATE_NEW`, do **not** call any creation tool here.
Prepare the local file and defer to the guarded create branch:

- Set `parent: <database-page-id>` (or a parent page id / sibling local path) in the new file's frontmatter.
- Re-run the validated search/absence and parent checks immediately before
  mutation. Absence is proven only by successful conformance-bound output.
- Require independently proven `conditional_create` and invoke that exact
  vector once, never `push`, as `[executable, create.command, ...create.flags,
  ...conditional_create.flags, stable_creation_key, staged_local_path]`; never
  hand the canonical authored file to an external creator or invoke the core
  create vector separately. If the verified profile
  declares it unavailable, return `status: refused`, preserve the observed
  B/L/R classification, set `next_action: provide_conditional_transport`, and
  do not create the page or mutate canonical local state.
- Require `notion-created-page-json-v1` output containing the returned canonical
  `ref`, parent, revision, path, relationships, and exact accepted body. Do not
  predict identity or depend on the transport rewriting the source file.
- Verification-pull that returned ref before the caller updates any canonical
  local metadata or base receipt.

## Frontmatter identity extraction

Extract `ref:` (preferred) or legacy `notion_url` from frontmatter before this
branch:

- Read each file's frontmatter to extract `ref:` (or legacy `notion_url`).
- If missing and a search hint is available: use the validated search branch above.
- If missing and no hint: mark as `CREATE_NEW` and ensure the file has a `parent:` frontmatter entry before Step 3.

The resolved identity never determines the local filename. Preserve the path
created by notion-sync or explicitly supplied by the caller.

## Project property policy

Transport preserves property names and values but does not interpret them.
Branch on a Notion property only when the caller supplies an explicit
destination-owned mapping that identifies the property, accepted values or
groups, and matching semantics. A missing or ambiguous mapping is a policy
refusal, never permission to infer labels from the live database. Preserve
unknown properties unchanged.
