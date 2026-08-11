# Design work artifacts

Use the active work directory reported by Essential. A design run has one
Markdown contract and one artifacts root:

```text
<work-dir>/
├── design.md                         # lazy PM-owned overview
├── design/
│   ├── <design-slug>.md              # task design and visual decisions
│   └── <design-slug>/*.md            # only after a required split
└── artifacts/design/<design-slug>/
    ├── boards/                       # board HTML + rendered image
    ├── previews/<preview-slug>/      # preview HTML + screenshots
    ├── captures/                     # browser and computed-style evidence
    ├── diffs/                        # design/build comparisons
    └── inventories/                  # facelift and content evidence
```

Create only artifacts directories the task needs. Application files remain in
their owning source paths. Task evidence lives only under
`<work-dir>/artifacts/design/<design-slug>/` — the `<design-evidence-dir>` the
rest of this skill names.

## Bootstrap and resume

1. Read the shared state contract, then active `state/working.md` and
   `state.md`.
2. Name `<design-slug>` per `naming.md` in the essential plugin's
   `references/` directory. Inspect
   `design.md` and `design/` for an existing child with the same stable target.
3. If one exists, ask whether to resume it or create a distinct child. On
   resume, read its current focus, decision log, evidence map, implementation
   state, and next action before generating a board.
4. On a new run, create `design/<design-slug>.md` with status `draft`, headline,
   owner, timestamp, work ID, target, authorization mode, and provenance.
5. A worker returns the child path. Only the PM creates or reconciles the lazy
   `design.md` overview and links it from `state.md`.

The design child is the complete domain contract. `state.md` remains the owner
of the whole work goal, plan, dependencies, and cross-domain lifecycle state.

## Required design-child content

Load every child in the ordered [`design.template.md`](design.template.md)
manifest. At every save point keep these sections current:

- target, audience, inputs, constraints, authorization, and confirmed
  visual/content/interaction direction;
- detailed visual decisions: every presented candidate, rank rationale, chosen
  or merged design, rejected alternatives and reasons, confirmation, and next
  action;
- tokens, typography, layout, responsive behavior, component states,
  accessibility, motion, reduced-motion, and separator choices;
- component/source inventory and design-to-source mapping;
- current design phase, implementation status, last good evidence, failed
  gate, residual divergences, and exact next action;
- evidence and source file map; and
- promotion candidates and their accepted/rejected disposition.

Record each visual choice immediately. Never record only “#2 chosen”; preserve
enough concrete composition, hierarchy, content, type, palette, spacing,
responsive, state, motion, and boundary detail to reproduce the choice without
the image.

If the design child exceeds 16,384 bytes in the PM's final batch pass, retain
it as the overview and move coherent sections to lowercase same-stem children
such as `design/<design-slug>/20-visual-system.md`. Never split early merely
because it crossed the 12,288-byte authoring guide.

## Evidence lifecycle

Boards are task evidence. Keep matching HTML and rendered images together.
Previews, captures, diffs, and inventories stay below the same artifacts root.
Markdown records concise conclusions and relative evidence paths, not embedded
screenshots, base64 payloads, or full logs.

Keep active evidence through sign-off. Retirement follows the shared work
retention contract; no design skill deletes it automatically.

## Legacy inputs

Project-root `.design`, `.design-*`, `DESIGN.md`, `CONTEXT.md`, and
`DECISIONS.md` are legacy inputs, not active locations. When found:

1. report every exact path and its apparent work target;
2. propose a content map into `state.md`, `design/<design-slug>.md`, and the
   artifacts root;
3. require approval before copying or moving anything;
4. preserve provenance and do not overwrite an existing child; and
5. never delete legacy paths automatically, even after successful migration.

## Durable promotion

Task detail stays local. After review and sign-off, promote reusable system-wide
rules to `docs/design/system.md` and durable non-system design to
`docs/design/<design-slug>.md`. Each original durable path remains its overview;
use a same-stem detail directory only when logical separation materially
improves ownership or navigation. Durable `docs/**` has no mechanical size
limit. Reconcile `docs/design/README.md` and `docs/README.md` so every promoted
design is reachable. Record work ID, source evidence, review, and supersession
provenance.
