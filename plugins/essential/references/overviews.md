# Work overviews

Read this when creating or reconciling the global `.state/overview.md`, or the
work-local `proposals.md`, `changes.md`, `decisions.md`, or `design.md`.

## Global overview (`.state/overview.md`)

```markdown
# State overview

- Updated: `<timestamp>`

## Goal
## Requirements

## Awaiting you

| Stream | Question | Waiting since |

## Streams

| Work ID | Phase | Blocked on | Last progress | Headline | Next action | Location | Links |

## Recently landed
```

- `Goal` and `Requirements` are authored, never derived; every upsert and
  rebuild preserves them byte-for-byte, as it does every unrefreshed row.
  Environment narrative is not preamble — it belongs in `environment.md` and
  `traps.md` ([work-memory-topology.md](work-memory-topology.md)).
- `Awaiting you` is derived from every stream's `state/unresolved.md`, so a
  question only the user can answer is not buried one file deep in a stream
  nobody is reading.
- `Phase` is the stream's own field, unchanged
  ([state-format.md](state-format.md)). `Blocked on` is
  that stream's nullable `- Blocked on:` line rendered into a cell, which
  cannot be absent: write the named blocker, `unknown` when the stream is
  stopped and nobody recorded why, or `-` when it is not blocked. `-` and
  `unknown` are different facts — one says nothing is holding the stream, the
  other says something is and the reason was never written down — and a row
  that renders the second as the first hides a forgotten stream among the
  healthy ones.
- `Last progress` is the date of the stream's last journal `status` event plus
  its age — `2026-07-30 (7d)`. Never any-write, never file mtime: a reformat
  or a bulk backfill is not progress, and mtime dies the moment `.state/` is
  copied out and back, which is the designed recovery path. Where the journal
  is segmented, read the newest segment file, never the tail of the
  `state/journal.md` index — the index's last line is written whenever a
  segment is added, so reading it dates every segmented stream to its last
  bookkeeping sweep and reports dead streams as fresh.
- `Next action` is one imperative sentence at or under 200 characters — long
  enough for the next step, too short to append to. Without that budget each
  handover adds to the cell instead of replacing it, and the index becomes the
  narrative it was meant to point at. Narrative stays in the stream.
- `Location` is the absolute path of the checkout the stream's code is worked
  in plus its tree kind, or `-` when the stream records no anchor. Never infer
  one: an inferred location manufactures a fact that reads exactly like a
  recorded one. Absolute paths are safe here because `.state/` is
  machine-local and ignored.
- `Links` carries the stream's specification and durable `docs/` material
  together — most rows have neither, and the width belongs to columns that
  carry signal. A capability the stream holds accepted-but-unpushed deviations
  against is suffixed `(pending-publication)`; resolve a sibling's pending
  publication before planning new work against that capability.
- Qualify a cell in the cell. A `†`/`‡` glyph legend is a second vocabulary a
  reader must learn before reading the first.
- Sort by phase, then `Last progress`. Ordering costs nothing and cannot go
  stale, which is exactly what a priority column cannot claim — do not add one.
- `Recently landed` lists completed streams one line each, hard-capped at 20.
  It is a memory aid, not an index: `archive/<work-id>/state.md` holds the
  rest, and it does not go stale.

Every stream in `.state/works/` is exactly one row. A completed row leaves the
table on the schedule in [retirement.md](retirement.md), and every fact in it
comes from that stream's `## Completion receipt`, so dropping it loses
nothing.

## Lazy work overviews

Create each work-local overview with the first child in its corresponding
folder; once created, retain it until work closes. The
PM/coordinator alone reconciles these overviews; subagents may create or
update assigned children and return them in their output manifest.

### Proposals vs changes

`proposals/` and `changes/` both document a work stream's tasks and
implementation against the active canonical specification — the canonical
Notion spec for a Notion-backed contract, the source at its exact path for a
reachable `repo:` local contract (the derived carrier is only
content-equivalent, never the authority), or the durable carrier for a
`local-approved:` or `inline-approved:` contract. They differ by
**implementation state**, not by approval and not by being deviations. A
`proposals/` child is anything proposed but **not yet implemented**: most
often a task to implement the work stream (derived from the canonical spec —
for a Notion-backed contract, from the canonical Notion spec), but also a
bounded research finding, a decision proposal, or a specification-change
proposal awaiting reconciliation. When the work is done, its final
implementation documentation shifts to a `changes/` child, together with any
last-mile changes made during implementation. A `changes/` child therefore
also holds general implementation and explainer records, not only deviations.

Approval is a **status on the proposal, not a folder move**. A proposal is
`open` until the user approves it and `accepted` once approved, so downstream
planning can tell an approved proposal from an undecided one — but an
approved proposal that is not yet implemented stays in `proposals/`; only
implementation shifts it to `changes/`. A proposal never approved ends in
`proposals/` (`rejected` or `withdrawn`). Separately, the coordinator creates
or links the corresponding `changes/` child as implementation proceeds — that
child may be `pending` before it becomes `applied`. A `changes/` child links
back to its originating proposal **when one exists**; a direct change record
with no proposal (a review explainer, an implementation-time material
departure) is complete without that back-link. `state.md` carries the list of
proposals still awaiting user approval and those approved but pending
implementation, so a resume sees the outstanding work at a glance.

Each `proposals/` and `changes/` child SHOULD carry a section recording any
deviations from the canonical specification, if any — deviations are an
optional subsection, not what defines the folder.

### Lazy overview shape and statuses

Each work-local overview contains only:

1. Purpose and one headline summary.
2. Counts by canonical status.
3. A table with `status`, one-line `headline`, and relative child `path`.
4. `last_pm_reconciliation` as an ISO-8601 timestamp.

Do not copy child detail into an overview. `state.md` links to the overview,
not directly to the folder. `state/working.md` links only to the overview or
child needed for the current focus.

| Overview | Child statuses |
| --- | --- |
| `proposals.md` | `open`, `accepted`, `rejected`, `withdrawn` |
| `changes.md` | `pending`, `applied`, `reverted`, `superseded` |
| `decisions.md` | `proposed`, `accepted`, `rejected`, `superseded` |
| `design.md` | `draft`, `approved`, `implemented`, `promoted`, `superseded` |

Each child starts with structured metadata containing at least its canonical
status, one-line headline, owner, created timestamp, and source/provenance
references. A `decisions/` child additionally follows
[decision-causality.md](decision-causality.md): causal metadata
(`supersedes`/`affects`/`invalidates`/`preserves`), the blast-radius sweep on
acceptance, and the completion gate that dispositions every accepted decision
before retirement.

When a `proposals/` or `changes/` child's deviation section records a
deviation from a Notion-backed specification, that deviation's provenance
MUST link to the related `.mdc` file under `.state/notion/`. All of
`.state/` lives on the default source tree, so that link resolves from
whichever checkout the work is done in; a Notion-backed spec deviation
recorded without that link is incomplete. A
non-Notion contract has no such folder and cites its authoritative source
instead of inventing Notion provenance: a reachable `repo:` local source
keeps its exact source path authoritative and cites that path (the derived
carrier is only content-equivalent), while a `local-approved:` or
`inline-approved:` source cites its durable carrier as the sole authority.

If an overview itself ever requires splitting, reserve `00-index-<group>.md`
names inside its folder for index shards.
