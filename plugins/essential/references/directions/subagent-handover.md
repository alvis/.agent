# Subagent handover

Read this before composing the first task handover to a subagent. This file owns
that prompt interface; task-specific instructions add detail without restating
or renaming its fields.

Resolve the stable Work ID, runtime Task ID, PR ID, or full commit SHA required
by [naming.md](../naming.md) before sending. Put that reference alone on the
first line, before the fields below; an ordinal or semantic task label is not a
substitute.

## First prompt

Use these top-level fields in this order:

```text
<stable-reference>

Goal: <verifiable outcome, expected quality bar, and why it matters>

Requirements:
- <mandatory deliverable, behavior, acceptance criterion, or required reference>

Boundary:
- <files, actions, permissions, or responsibilities the agent must not cross>

Directions:
- <non-binding hints that may help achieve the goal>

Context:
<task-specific context structure>
```

Assign exactly one bounded task. Keep the complete first prompt within the
4,096-character message ceiling. Put mandatory behavior, acceptance criteria,
and required standards in `Requirements`; keep `Directions` advisory.

`Context` extends the base interface to fit the task. `Decisions` and
`Recent work` are standard subsections, and authors may add subsections such as
`Inputs`, `Risks`, `Dependencies`, or `References` without changing or
duplicating the other top-level fields.

## Context items and paths

- `Decisions` and `Recent work` may each contain multiple relevant items.
- Each item summary contains 1–19 words; its label and path do not count.
- `Recent work` excludes decisions.
- Omit an empty Context subsection instead of writing a placeholder.
- When two or more items share a container, put an absolute `Path:` before
  them and use relative item paths. Use the deepest useful shared container.
- If different subsections use different shared containers, give each its own
  `Path:`. Items without a shared container carry absolute paths.
- Reference durable content instead of pasting it. Never persist secrets or
  transient credentials.

When the whole Context shares one container:

```text
Context:
Path: /absolute/path/to/work

Decisions:
- Adopt the indexed event model for replay safety — decisions/event-model.md
- Keep public identifiers stable across imports — decisions/import-identifiers.md

Recent work:
- Parser migration landed; consumer conversion remains — state/journal.md
- Latest review found two unresolved edge cases — reviews/parser-review.md

Inputs:
- Approved implementation specification — specifications/parser.md
```

When only one subsection shares a container:

```text
Context:
Decisions:
Path: /absolute/path/to/work/decisions
- Adopt indexed event replay — event-model.md
- Preserve public identifiers — import-identifiers.md

Recent work:
- Parser migration landed; consumer conversion remains — /another/path/journal.md
```

This structure applies only to the first task handover. Later messages contain
terse deltas and paths under the orchestration contract.
