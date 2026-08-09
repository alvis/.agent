---
name: handover
description: Persist engineering work stream state and update the global overview, both in the default source tree's centralized .state/, so the session can pause and any later session resume from the files on disk. Use when pausing coding work; this skill records continuity and does not execute the work.
model: opus
argument-hint: "[work-id-filter]"
---

# Work Handover

Refresh the work-stream memory under the **default source tree's**
`.state/` — the resolver's `state_root`, the one tree that carries work
state whichever worktree or workspace you are in — and update the global
`.state/overview.md` beside it, so the session can stop here and a later
one pick the work up exactly where it stands. `essential:takeover` owns resumption; it
always resumes from the state files on disk.

## Boundaries

- Use for pausing engineering work streams.
- Handover is scoped to the streams it is pausing. All state already lives in
  one place — `state_root/.state/works/` — so there is no other tree's
  state to reach into and no cross-tree merge to perform. Refresh the selected
  streams and upsert their `overview.md` rows; leave every other stream's files
  and rows byte-for-byte alone.
- Do not perform git history, push, PR, build, test, deployment, review, or
  implementation work.
- Write to exactly two destinations:
  `state_root/.state/works/<work-id>/**` and
  `state_root/.state/overview.md`. Handover does not promote to `docs/` — promotion
  belongs to completion, not to a pause — and it creates no continuation file
  of its own: the state files *are* the continuation.
- Never write a file because the report would be large. A long report is
  shortened to pointers into `.state/`, never spilled to disk; the
  persisted state on disk is already the durable outcome.
- Do not assume `.state/` is committed.
- Only the main agent/PM may run this workflow because it writes `state/working.md`
  and reconciles work indexes and the overview.

## Inputs

- Optional `[work-id-filter]`; otherwise handle every work stream under
  `state_root/.state/works/`. A filter narrows the streams to refresh in
  full; it never invents a stream.
- Persistence requires only a repository checkout and a resolvable workspace.
  A pause needs nothing external.

## Engineering-work gate

Before creating or materially rewriting a project artifact, read the absolute
`engineering-work.md` path injected by Essential. If unavailable, stop artifact
writes and report the missing contract. Run the resolver: its `state_root` is
the default source tree that carries every work stream and the global
`.state/overview.md`, whichever tree this session is working in. Resolve the work root,
conventions, naming, and ownership from that reference before reading or writing
state. Handover never mints an empty work item. Hold each selected stream's
on-disk coordinator lease before rewriting its state in steps 5–7 with the
idempotent `state-lease ensure` verb — it renews a lease this session
already holds and acquires a free one; a live foreign lease (`contended`)
stops that stream with a report. Perform the rewrites through the
lease-verified write path in Essential's `lease.md`, bump `State revision`
on each coordinator rewrite, and release every lease at completion.

Persistence always runs and always completes: it refreshes the current source
tree's on-disk work state and the default tree's global `overview.md`. That is
the whole outcome — a session can pause, close, and later resume from those
files. Never terminate the run before the overview upsert.

## Workflow

1. List every `state_root/.state/works/<work-id>/` stream per the
   Essential contract — always the complete set, never narrowed by
   `[work-id-filter]`, because the overview upsert (step 7) must show every
   stream. For each stream, read `state.md` to record its lifecycle status and
   one-line headline. Partition the streams three ways: `initialized`, `active`,
   and `blocked` are **continuable**; `reviewing` is **awaiting merge** — its
   execution is finished and its pull request(s) are proposed, so it is not
   continuable, but neither is it settled, and `essential:takeover` checks it for
   merge evidence; `completed` and `retiring` become **index-only** rows. None of
   these is an error.
   Then apply the optional `[work-id-filter]` to the continuable streams to
   derive the **selected** streams (all continuable streams when no filter is
   given); only the selected streams get a full refresh (steps 2–6). The filter
   never removes a stream from step 1 or the overview.
2. For each selected stream, read `state/working.md` first when present, then
   `state.md`, its linked detail files, the four lazy overview files, `review.md`,
   relevant review areas, evidence, and the materialized working specification.
   From the `state.md` task table, determine which tasks are runnable, which are
   blocked, the current owner, and the next action; proceed on that reading, with
   no separate validation step. Treat repository and runtime evidence as
   authoritative over stale local memory. Any implementation detail that root
   state links is procedure keyed by existing task IDs, not plan authority.
3. For each selected stream, gather todos, current revision/bookmark/branch,
   working-copy status, staged and unstaged changes, untracked files, recent
   commits, and each specification's location: inline raw text, a
   repository-relative path, or a Notion reference with its captured revision.
   Classify changed and planned files with the substates in
   [references/document-templates.md](references/document-templates.md).
4. For each selected stream, identify every material unresolved decision.
   Consult the user using
   [references/decision-consultation.md](references/decision-consultation.md);
   route durable decision detail to `decisions/<slug>.md` and let the PM
   reconcile `decisions.md`. Record low-impact reversible assumptions in
   `state.md` with evidence and recheck triggers.
5. Generate one UTC ISO-8601 timestamp for the whole run. For each continuable
   stream, rewrite `state.md` as the complete work context: goal, full
   parent/subtask task table with marked status and evidence, lifecycle, success
   criteria, decisions, dependencies, blockers, review dispositions, evidence,
   durable promotion, specification location, and a prominent link to
   `state/working.md`. Include a `## Continuation` section persisting the current
   task ID, exact next owner, exact next action, a capability-level continuation
   intent describing the work type (never a fixed skill name), and the stream's
   **source anchor** — the revision the work assumes. State alone must be enough
   to route a resume and to tell a checkout which revision to be at. If eligible
   work Markdown requires splitting under the shared batch process, keep the
   original path as overview.
6. For each selected stream, rewrite `state/working.md` to approximately 4,096
   bytes through editorial discipline: current focus, current status, immediate
   handback point, and fast relative paths only. It is not a plan, history, or
   complete context. Do not mechanically size-gate it. Reconcile that stream's
   existing lazy `proposals.md`, `changes.md`, `decisions.md`, and `design.md`
   overview files from child metadata; never copy child details into an overview.
7. Update the global `state_root/.state/overview.md`, following the
   canonical shape in
   [references/document-templates.md](references/document-templates.md).
   Immediately before writing, re-read the current `overview.md` so a concurrent
   update from another session is not lost. Upsert one row per stream from
   step 1 — work ID, lifecycle, headline, next action, `Location` (the checkout
   the stream is worked in: path plus kind and revision), and any `docs/` link
   in `Documentations` — and preserve every other row, and the authored
   `Goal` and `Requirements` sections, byte-for-byte. If no
   `overview.md` exists yet, create it. After this write the pause is complete
   and resumable from state files.
8. Return every created or materially rewritten path — including the updated
   `overview.md` — in `generated_files`. Do not run file sizing; after all
   artifact writers finish, the PM checks only eligible work Markdown inside the
   target `.state/` and coordinates any complete split round.

## Verification

- Every selected stream's `state.md` (with its `## Continuation` fields) and
  `state/working.md` were refreshed and the global `overview.md` was upserted.
- Handover touched only `state_root/.state/works/` and
  `state_root/.state/overview.md`; no unselected stream's files were
  rewritten.
- `overview.md` now carries one up-to-date row per stream — each with its
  lifecycle, `Location`, `Spec`, and `Documentations` — and every row it did not
  own is unchanged.
- A takeover could resume every continuable stream from the on-disk state alone —
  `## Continuation` names the current task, next owner, next action, and
  continuation intent.
- No path outside the closed write set was created or rewritten: every entry in
  `generated_files` is under `state_root/.state/works/<work-id>/`, or is
  `state_root/.state/overview.md`. No continuation file was written anywhere else,
  and nothing was written because output was large.
- Each selected stream's `state.md` is complete, internally consistent, and links
  `state/working.md`; the latter contains only current-focus summary and fast
  paths.
- Every overview matches its children and canonical status vocabulary.
- Decisions, assumptions, deviations, blockers, review dispositions, evidence,
  promotion, and specification state are preserved per selected stream.
- No secret, credential, absolute host path, path traversal, or symlink escape
  is present in the report.
- Every held coordinator lease was released and each refreshed stream states
  its `State revision`.

## Completion

Use [references/output-format.md](references/output-format.md). Report the
working tree each stream is worked in, the `overview.md` path, the stream count,
per-stream updated state paths and work directory, classification and decision
counts, and `generated_files`. `handover: complete` reports the successful pause
once persistence and the `overview.md` upsert land; reserve `handover: blocked`
for a failure that prevents persistence itself. Examples live in
[references/examples.md](references/examples.md).
