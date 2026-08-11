# Work-memory topology

Read this when creating, locating, or migrating ignored local state.
`state.md` owns the lifecycle and resolver; `state-format.md` owns state
semantics.

```text
.state                                  # ignored operational work memory in the default source tree
├── overview.md                         # authored goal plus the derived index of every stream
├── environment.md                      # dated, re-measurable trees, refs, and gates; never per-stream
├── traps.md                            # one line each: symptom, cause, and what to do instead
├── notion                              # default-source-tree Notion mirror
├── archive/<work-id>                   # completed or parked stream; never enumerated by the resolver
└── works/<work-id>                     # one live stream, phase planned, working, or reviewing
    ├── goal.md                         # approved charter, scope, and success criteria
    ├── state.md                        # complete resumable context and canonical task graph
    ├── lease.json                      # coordinator ownership and expiry record
    ├── state                           # focused execution views and append-only history
    │   ├── working.md                  # narrow current focus and handback point
    │   ├── journal.md                  # append-only state transition record
    │   ├── revisions.md                # approved plan and charter revision history
    │   ├── unresolved.md               # unresolved questions and blocking unknowns
    │   ├── plan.md                     # optional non-authoritative task detail
    │   └── discovery.md                # resumable findings and evidence pointers
    ├── spec                            # temporary materialized specification inputs
    ├── proposals.md                    # lazy index of proposed choices
    ├── proposals/*.md                  # one proposed choice and its disposition
    ├── changes.md                      # lazy index of approved execution departures
    ├── changes/*.md                    # one approved departure and its evidence
    ├── decisions.md                    # lazy index of durable decisions
    ├── decisions/*.md                  # one accepted, rejected, or superseded decision
    ├── design.md                       # lazy index of work-local design
    ├── design/*.md                     # one design candidate or reasoning unit
    ├── review.md                       # review-area roll-up and closure status
    ├── reviews/*.md                    # one area-specific review and its findings
    └── artifacts                       # non-Markdown evidence and generated carriers
```

`archive/` is the single sink for every stream that leaves `works/`, whether
it completed or was parked. Keep it singular: a sibling `archives/` would
leave every future reader guessing which of two near-identical directories
holds what. Why a stream left is recorded in its own `state.md` completion
receipt, never encoded in the directory name, so the reason survives being
moved and can say more than one word.

`environment.md` and `traps.md` sit beside `overview.md` rather than inside
it because they rot on a different clock: which trees, refs, and gates exist
changes when the repository does, not when a stream advances, and a trap is
true until the underlying tool changes. Both are re-measurable and dated; a
claim in either that no longer reproduces is replaced, not annotated.
