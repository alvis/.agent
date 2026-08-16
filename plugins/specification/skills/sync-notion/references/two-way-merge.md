# Base-aware two-way merge

Load only for `two-way-merge`. Although the public mode has a familiar name,
the safety decision is a three-way comparison of immutable base B, current
local L, and a fresh remote staging pull R.

## Preconditions

For every pair require stable identity, B bytes/hash from an immutable receipt,
L bytes/hash, R bytes/hash/revision, and a caller-declared staging/evidence
root. Missing base evidence returns `status: refused`,
`classification: baseline_required`, and `next_action: establish_baseline`;
never manufacture a base from L or a cached mirror.

When called by `sync-spec`, compare the specification content directly: exact
bytes and revision protect transport, and semantic content equality
(disregarding the volatile `last_edited_time` line) drives the relationships
below. Never approve content you have not compared directly against B.

Classify before conflict work:

- `L == B && R == B`: unchanged; no write or push.
- `L != B && R == B`: local-only; no merge needed, but outbound approval and
  the pre-push revision gate still apply.
- `L == B && R != B`: remote-only; stage a pull candidate and return
  operational `status: success`, `classification: remote_only`, and
  `next_action: revalidate` to a specification caller rather than overwriting
  local work or pushing it back.
- `L != B && R != B && L == R`: converged; verify and establish a new base,
  with no push.
- `L != B && R != B && L != R`: concurrent; follow the protocol below.

## Phase 1 — conflict packets

Fan out read-only comparison workers by independent pair. Workers never invoke
the graphical or structured user-input tool, choose a winner, edit canonical local/mirror files, or push.
Each worker:

1. Computes deterministic section/block differences from B→L and B→R. It may
   use structured diff output supported by the pinned CLI, but must not invent a
   flag; deterministic comparison of staged bytes is the fallback.
2. Maps transport block ids to the nearest stable heading/path for presentation
   while retaining ids only as write-back evidence.
3. Distinguishes non-overlapping changes from overlapping conflicts. It builds
   candidate Keep Local, Keep Remote, and coherent Keep Both content without
   applying any candidate.
4. Stores a bounded conflict packet and candidate content under the declared
   staging/evidence root, and returns paths rather than embedding a complete
   document in the task response.

```yaml
pair:
  local_path: ''
  notion_ref: ''
  base: {revision: ''}
  local: {revision: ''}
  remote: {revision: ''}
packet_path: ''
conflicts:
  - id: ''
    section: ''
    kind: addition|removal|modification
    evidence: {base: '', local: '', remote: ''}
    candidates: {keep_local: {path: ''}, keep_remote: {path: ''}, keep_both: {path: ''}}
issues: []
```

A worker failure aborts that pair without canonical writes.

## Phase 2 — owner decisions

The coordinator loads each packet and asks the PM/user for every material
conflict. Present bounded B/L/R evidence and these choices:

- **Keep Local** — use the local section.
- **Keep Remote** — use the fresh remote section.
- **Keep Both** — use the coherent synthesis, after showing it and receiving
  explicit approval of its candidate content.
- **Skip** — leave the pair untouched for later resolution.

Keep Both must integrate facts into the owning section without parallel
“local”/“Notion” sections or provenance banners. Any revision to the synthesis
changes its content and requires approval again. Skip never inserts a TODO or
feeds a push candidate.

## Phase 3 — freeze and apply

Assemble one complete final proposal for the pair in staging, preserve
frontmatter/order/identity. Require the caller's stage-specific approval/review
to be bound to the final specification content, confirmed by direct comparison.
If any conflict is skipped, unresolved,
or failed, mark the pair `partial` and apply nothing to its canonical local,
mirror, or remote sides.

When the caller declares `stage=implementation`, return operational
`status: success`, `classification: concurrent`, and
`next_action: specification_reconciliation` with the immutable proposal and
apply nothing. The owning specification flow must approve and publish it through
specification stage, verify it, establish/materialize a new base, and invalidate
plan/code/review before implementation can resume. Never push proposal M from
this implementation-stage merge.

For a fully resolved `.mdc` pair, the coordinator applies the staged body only
through the exact capability bound as `body_author`, after its selector matches
the caller/receipt and every decision and approval gate passes. The capability
receives only the approved body and exact staged path. Plain Markdown may be
atomically promoted only when the caller permits it. Do not push here; the mode
execution branch owns the immediate remote recheck, guarded push, and
verification pull.

```yaml
status: success|partial|failure|refused
classification: resolved|unchanged|local_only|remote_only|converged|concurrent|baseline_required
next_action: none|revalidate|establish_baseline|resolve_conflict|specification_reconciliation|provide_conditional_transport
pair: {local_path: '', notion_ref: ''}
conflicts: {found: 0, resolved: 0, skipped: 0}
decisions: {keep_local: 0, keep_remote: 0, keep_both: 0}
final_proposal: {path: '', revision: '', approved: false}
canonical_writes: 0
push_allowed: false
```

Operational execution and relationship classification are separate. A missing
base is `status: refused`, `classification: baseline_required`, and
`next_action: establish_baseline`; remote-only is successful read-only
classification plus `revalidate`; an implementation-stage concurrent proposal
is successful read-only classification plus `specification_reconciliation`.
Never encode those relationship outcomes as new top-level status values.
