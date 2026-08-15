# Making plans

Read this direction before creating, revising, or presenting any plan. A plan
may be a short conversational sequence, a persisted handoff, a task graph, or a
commit/PR structure. Domain directions may add detail; they do not replace the
minimum contract below.

<IMPORTANT>
A plan is a route through authoritative truth, not another home for that truth.
Read the current contract, decisions, execution state, and evidence first. Link
to their owning files instead of copying details that can drift. If a required
source is absent or contradictory, name the gap and route it to its owner; do
not invent a coherent-looking plan around it.
</IMPORTANT>

## Required ingredients

Every plan makes these ingredients available in this order. Use headings for a
persisted or material plan; compact plans may use labeled lines. When another
artifact owns an ingredient, give the exact path and only the summary needed to
navigate it.

### Goal

State one verifiable outcome and the bar that proves it was achieved. Link the
authoritative charter or specification when one exists.

### Requirements

List observable conditions the outcome must satisfy. Preserve identifiers from
the authoritative contract so execution and verification can cite them.

### Boundary

Name what is inside the plan, what is deliberately outside it, and any limit on
authority, time, systems, data, or validation that changes execution.

### Direction

State the chosen route: ordered work or dependency graph, owners where relevant,
verification at each meaningful boundary, and stop or pivot signals. Link
material choices to their decision records; do not reopen accepted decisions in
the plan.

### Context

Include exactly these navigation aids:

- **Current state** — a brief, revision-aware status and the immediate next
  action or blocker.
- **Related decisions** — zero or more record items, one per directly related
  decision. Each summary uses at most 19 words, excludes decision detail, and
  links the file containing the full decision.
- **Related recent work** — zero or more record items, one per directly related
  work record. Each summary uses at most 19 words, excludes decisions, and
  links the file containing the full journey.

Exclude records that are merely adjacent to the plan.

Under each related-record label, use `None — no directly related record` only
after checking the applicable authority; never create a placeholder file to
satisfy a context line.

## Truth ownership in work state

For a lifecycle-managed work stream, the shared ingredients are distributed
without duplication:

- `goal.md` supplies Goal, Requirements, and Boundary through the charter link;
- root `state.md` task definitions and dependency edges supply Direction; and
- root status plus links to `decisions/` and `state/journal.md` supply Context.

Non-authoritative detail such as `state/plan.md` may expand an existing task ID,
but it cannot redefine any shared ingredient. Follow the state lifecycle for
ownership, revisions, and approval.

## Revision and verification

Revise Direction without operator approval when evidence changes the route but
Goal, Requirements, and Boundary remain fixed and the owning workflow grants
that authority. Surface any proposed contract change to its owner before
continuing.

Before handing off, approving, or executing a plan, verify that every required
ingredient is present or linked, the goal has a measurable bar, requirements
are testable, boundaries expose exclusions, direction is executable, context is
current, every context link resolves, every listed record is directly related,
and each decision/recent-work summary is at most 19 words.
