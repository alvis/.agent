# State-file format

Use this convention for every new or coordinator-migrated `state.md` and every
resumable `state/*.md` child. A work item is free-form, LLM-readable Markdown:
nothing is machine-validated and any layout a reader can follow works. This
document describes the shared shape that keeps state files easy to resume from;
Essential owns the convention, domain skills own task definitions and evidence.

## Roles and authority

- Root `state.md` is the complete execution registry. Its `## Tasks` table
  contains every parent and numbered subtask in the work item, even when a
  `state/*.md` child mirrors a subset for detailed resumption.
- A child state declares `State role: child` and `Parent task: ABC`. It cannot
  introduce an ID absent from the root registry. The coordinator reconciles
  its mutable fields with the root before dispatch or handover.
- Root state uses `Plan source: state.md`: the complete root task registry is
  the approved definition source and consumers never guess among planning
  files. `state/plan.md` may hold ID-keyed semantic detail, but it is
  non-authoritative and cannot introduce or redefine tasks.
- There is no required header token. Preserve any existing state file
  byte-for-byte until the coordinator performs an explicit rewrite; the resolver
  never rewrites it.

Root state metadata contains at least:

```markdown
- State role: `root`
- Work ID: `eng-421-example`
- Phase: `working`
- Blocked on: `accessibility review`
- Charter: [goal.md](goal.md)
- Plan source: `state.md`
- Plan revision: `3`
- State revision: `41`
- Written under: `a1b2c3d4`
```

The charter pointer names the work's `goal.md`, which owns the goal, scope,
numbered success criteria, and specification provenance; the root state never
restates them. That charter carries
`Charter: approved | reconstructed | absent`: `approved` means the user agreed
to those success criteria, `reconstructed` means a later reader wrote them
from what the work had already done, and `absent` means the stream has no
`goal.md`. An `SC-n` cited against a reconstructed charter is a description,
never an operator commitment, so it cannot close work on the user's behalf —
get the charter approved first. `absent` is a defect to repair, never a shape
to run under: a stream with no charter has no success criteria to demonstrate,
so nothing can show it is done. Write the charter and get it approved.
`Plan revision` counts approved definition changes, starting at
`1`. `State revision` is a monotonic counter bumped on every coordinator write
of `state.md` (progress and definition alike), starting at `1`; it orders
journal lines and lets the lease and doctor detect a stale writer.
`Written under` records the short hash of the state contract this
file was bootstrapped or last coordinator-rewritten against — provenance
only, stamped by the resolver and rewrites; it confers no authority (the
current contracts always judge) but lets the doctor report drift as "written
under X, current is Y" and order migrations by staleness. All three fields
apply to new and coordinator-rewritten files only — an older file gains them
at its next explicit rewrite under the lazy-migration rule, never on read.

## Phase and blockers

Where a stream sits in the pipeline and what is stopping it are independent
facts, so they are separate fields. Carried in one field, a stream blocked on
an operator either lies as "active" or, marked "blocked", loses its place in
the pipeline.

They are separate metadata lines, never one. Every reader of this metadata is
anchored at one key per line, so a single line carrying both —
`- Phase: planned · Blocked on: reviewer` — parses as neither field, and each
check gated on phase then reports a
confident zero for that stream instead of an error. The packed form looks
tidier, which is exactly why it must not be written: the cost is invisible at
the point where someone would re-pack it.

`Phase` is ordered and terminal at the end:

| Phase | Entry evidence |
| --- | --- |
| `planned` | user-confirmed work ID, `--bootstrap` run, charter written |
| `working` | an owner exists and at least one required leaf is runnable |
| `reviewing` | every required leaf `done` and the applicable submission recorded: pull request(s) for coding work; reviewed deliverables and required accepter for non-coding work |
| `completed` | coding work observed merged or present on the default branch; non-coding work explicitly accepted with a promotion receipt listing durable paths or evidenced `not required` |
| `archived` | completed or parked; the directory has left `works/` |

`- Blocked on:` is orthogonal to phase, and it is **nullable**: write the line
only when the stream is stopped. In `planned` or `working`, it names an
execution blocker. In `reviewing`, it may name the external landing or
acceptance wait even though every required executable leaf is already `done`.

| Line | Meaning |
| --- | --- |
| `- Blocked on: <named blocker>` | stopped, and the blocker is named |
| `- Blocked on: unknown` | stopped, and nobody recorded why |
| line absent | not blocked |

`unknown` is a first-class value, not an absent field. Collapsing the two makes
a forgotten stream read exactly like a healthy one, so a stream nobody owns
disappears instead of surfacing. Equally, an empty value or an unowned-shaped
placeholder (`-`, `none`, `tbd`) is not a value: an unnamed blocker cannot be
chased. Write the blocker, or write `unknown`.

Duration is never typed into this field. It is derived at read time from
`Last progress` — the last journal `status` event, or the marked `state.md`
fallback ([overviews.md](overviews.md)) — so a stored day count cannot rot
against the events that define it. Nor is a next action a value here: "due to
be moved to archive" is derived from phase `completed`, recorded landing
evidence, and the days since that landing evidence; the doctor's `retention`
check computes it. A computed next action in a fact field is the defect this
field exists without.

`initialized`, `active`, `blocked`, and `retiring` are retired words —
`initialized` is phase `planned`, `active` is `working`, `blocked` is
`Blocked on: <who or what>` at whatever phase the stream actually sits in, and
`retiring` is phase `completed` with no retention blocker; archival readiness
derives from landing evidence and elapsed time. A file written
under the single `Lifecycle status` field keeps it until the coordinator's next
explicit rewrite, which maps it through that list under the lazy-migration
rule, never on read.

Keep phase, blocker, task status, attempt outcome (`pass|fail|partial`), file
state, review state, and sync state in separately named fields. Never reuse
one vocabulary for another.

## Task identity and tables

Every state file has `## Status` and `## Tasks`. The root table uses exactly
these first nine columns:

```markdown
| ID | Mark | Status | Task | Depends on | Required | Acceptance | Owner | Evidence / next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

The `Task` cell is an immutable definition with the exact grammar
`<summary> [targets: <comma-separated targets>|none]`. Targets may be source
paths, artifact paths, or named external surfaces. Escape a literal Markdown
pipe as `\|`. Use `—` for no dependency and `yes|no` for `Required`.

- Give every top-level task one mnemonic ID matching `^[A-Z]{3}$`.
- Give every subtask its parent ID plus `01` through `99`, for example `LFE01`.
- Permit only that one child level. Promote deeper work to another parent.
- Assign IDs before approval. Never rename, recycle, or reuse an ID.
- Retain every assigned ID as history. Removed scope becomes an optional
  `cancelled` tombstone; never delete its row from a later plan revision.
- Treat a parent with children as a derived roll-up, not executable work. A
  parent with no children is an executable leaf.
- Store full IDs in `Depends on`. Parent dependencies reference parents;
  subtask dependencies reference siblings under the same parent. Prohibit
  cross-parent partial dependencies; promote that boundary to a parent.
- Treat row order and diagrams as presentation only.

Use these exact mark/status pairs:

| Mark | Status | Meaning |
| --- | --- | --- |
| `-` | `planned` | Definition is approved but execution has not started. |
| `⧗` | `working` | An owner is actively executing it. |
| `✓` | `done` | Acceptance is met and evidence is recorded. |
| `X` | `failed` | An attempt failed and has a retry or disposition. |
| `!` | `blocked` | Work cannot advance and has an owner/unblock action. |
| `⊘` | `cancelled` | An approved plan revision removed optional scope. |

Record `attempt:` plus either `retry:` or `disposition:` for failed work.
Record `unblock:` for blocked work. Required work cannot remain cancelled;
revise and reapprove the definition so it is optional or absent.

Validity is orthogonal to status (see Essential's `truth.md`). Mark/status
pairs are history and are never falsified; `✓ done` is terminal. When later
truth invalidates a done row's result, append
`validity: stale (<reason or superseding id>)` — or `validity: unknown (…)`
when unverified — to its Evidence cell and add remediation tasks with new IDs.
An unmarked row is `current`.

## DAG and roll-up semantics

`Depends on` is the authoritative graph. A chain is a linear DAG; use a
branching DAG only when dependencies justify it. Display the overall graph as
`LFE → {API,DOC} → VAL` and a local child graph as
`LFE01 → {LFE02,LFE03} → LFE04` when that compact notation is exact.
Inside the parent section, `01 → {02,03} → 04` is an optional derived
shorthand. Generated graph text or Mermaid is presentation only and never
redefines the task registry.

Derive a parent with children as follows:

- `planned`: all considered children are planned.
- `working`: a child is working, or completed child work leaves runnable work.
- `done`: every required child is done; when a parent has only optional
  children, every child is terminal and at least one is done.
- `failed`: an unresolved required child failed.
- `blocked`: required work remains but no child is running or runnable.
- `cancelled`: all considered optional children were removed by an approved
  plan revision.

A failed leaf blocks only its downstream closure. Independent siblings remain
runnable. The coordinator alone changes task status after reconciling a result
that carries `task_id`, attempt outcome, and evidence.
Any dependency edge that still names a cancelled predecessor is also blocked;
an approved plan revision must remove that obsolete edge before execution.
Reconcile a planned leaf downstream of any failed, blocked, or cancelled
predecessor to explicit `! blocked` with `unblock:` evidence. Leave ordinary
future work `planned` while it waits only on planned or working predecessors.
An executable task may become `working`, `done`, or `failed` only after every
own dependency and every predecessor of its parent is `done`; a task that
cannot be attempted is `blocked`, never `failed`.

A `planned` or `working` stream with a runnable required executable leaf
carries no `Blocked on:` line; its execution blocker requires unfinished
required work and no runnable required leaf. Phase `reviewing` requires every
required executable leaf to be `done` and the stream's applicable submission
recorded, and MAY carry the named external landing/acceptance wait as its
blocker. `completed` is terminal, reachable only from `reviewing`, only on the
applicable landing evidence. That transition clears a resolved submission
blocker and retains only a separate unresolved blocker whose owner and carrier
remain independently valid.
[stream-completion.md](stream-completion.md) states both in full. Passing
tests do not reach `completed` while review, sync, publication, or history
anchoring remains required.

## Completion receipt

A stream entering phase `completed` adds `## Completion receipt` to
`state.md`, holding the applicable landing evidence, a promotion receipt that
lists every promoted durable path or evidences `not required`, and every
outlives-me item with the owner that took it. Its `overview.md` row is
generated from this section, so parity is not a copy step — it is the check
that nothing consequential was ever overview-only, and the row can be dropped
on schedule without reading anything back out of it. An outlives-me item with
no owner blocks completion; [retirement.md](retirement.md) owns that rule and
what dropping the row costs.

## Reading state and definition changes

There is no separate validation step: before dispatch, review, handover,
takeover, cleanup, or retirement, read `state.md` (and `state/*.md` children)
directly and proceed on that reading. The plan definition is the root task
registry itself — IDs, `Task` summaries and targets, `Depends on` edges,
requiredness, acceptance. A "definition changed" check is simply re-reading
the file: a definition change takes effect the moment it is written and
downstream reconciliation follows the DAG rules above, while progress updates
(mark, runtime status, owner, evidence) never change the definition.

## Change control during execution

Plans change during execution; that is the normal path, not an exception.
When a mid-execution finding may change how, what, or why work is executed,
follow the journal → classify (task-local / plan-level / spec-level) →
resume procedure in Essential's [change-control.md](change-control.md).

`state/journal.md` is append-only: one line per status transition, decision,
plan or charter revision, sync event, sweep, or lease event —
`- <ISO-8601> <actor>@<capability_id> rev:<N> <event-type> <subject>: <transition or summary> [evidence: <ref>] [invalidates: <ids>]` —
newest last, never rewritten or deleted. `<subject>` follows the stable-reference
contract in [naming.md](naming.md): use a Work ID, Task ID, PR ID, or full Git
commit SHA, never an ordinal-only label such as `slice 1`. `<event-type>` is one of
`status|decision|revision|sync|sweep|lease`; `rev:<N>` is the
`State revision` the writer was at; `invalidates:` names outputs or evidence
the event made stale. A bulk rewrite across many streams — a migration, a
backfill, a reformat — takes `sweep`, never `status`. Migrating N headers is
not N streams making progress, and `Last progress` reads `status` events
only ([overviews.md](overviews.md)), so booking a sweep as `status` dates
every stream it touched to the day it ran and reports long-dead streams as
fresh, destroying the freshness signal the migration was run to restore.
Older lines in the pre-grammar form
(`- <ISO-8601> <actor> <task-id or event>: <summary>`) remain valid history.
`state/revisions.md` is the same discipline at plan granularity: one entry per
approved revision. Neither file is ever the plan authority; both make the
authoritative tables auditable and reconstructible.
