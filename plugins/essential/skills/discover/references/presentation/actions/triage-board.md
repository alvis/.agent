# Triage board direction

Use this direction when the decision _is_ a spatial arrangement: a set of items
that must be sorted into lanes, where which lane a card lands in — and its order
within that lane — is the whole answer. It fits backlog triage, a cut list, a
now/next/later split, or any "shuffle these into buckets" call where the user
reasons faster by moving cards than by answering a form. The board is a plan the
user shuffles and sends back, never a durable ticket editor: it writes one
generated reply, not a change to a tracker.

This is a convention board, like the specimen board. It reuses the shared shell
and the stage-3 drag runtime rather than inventing a new interaction, and it
carries a stable `data-board-id` so a hub can link it.

## Entry conditions

Reached from the `readiness` mode when the next move is to sequence known work,
or by a direct request ("triage the backlog", "sort these into now/next/cut",
"what makes the cut this cycle"). No new discovery mode is added. Do not reach
for a triage board when the user needs to _compare_ alternatives (that is ranked
options) or _understand_ a mechanism first (that is a domain explainer) — reach
for it only when the items are already known and the work left is to place them.

## Structural fidelity

1. Lay out at least three lanes as a `.discovery-kanban` grid marked
   `data-kanban-board` and `data-presentation-pattern="kanban-lanes"`. Each lane
   is a `[data-kanban-lane="<key>"]` column with a `.discovery-kanban-lane-head`
   (title plus a `[data-kanban-count]`) and a one-line rationale so the lane's
   meaning is legible, not just its name.
2. Put the cards for a lane inside a `[data-drag-probe][data-kanban-cards]`
   container so the stage-3 drag runtime wires the drag feel, the within-lane
   reorder, and the per-lane order serialization for free. Give each probe a
   `data-probe-label` ("Now lane — order") so its Interaction-results line reads
   cleanly. Author at least six cards across the lanes.
3. Build each card as a `.discovery-drag-item .discovery-kanban-card` with a
   `data-drag-item` id and a human `data-drag-label`. Carry enough on the card
   to triage it — a title, its identifier and size, an owner chip — not a bare
   name.
4. Give every card a keyboard fallback: a per-card lane selector as an ordinary
   `data-discovery-question` (`.discovery-kanban-move` with a native `<select>`,
   one `data-lane` option per lane). Mark the starting option `selected` and the
   control `data-recommended="true"` so an untouched card travels back as the
   coder's suggestion and a moved card as the user's decision.
5. Keep the two in sync with one small page-inline script: a pointer drop into
   another lane moves the card node and points its selector at the new lane; a
   selector change moves the card node. Lane membership rides the selectors into
   the prompt's confirmed decisions; within-lane order rides the drag probes into
   Interaction results. On reload, reconcile card positions to the hydrated
   selector values so a card never sits in one lane while claiming another.
6. Carry the full shared shell: masthead, annotatable sections, one folded
   generated prompt, and the runtime-built section nav. Reuse `prompt-echo` for
   the originating request, provenance pills for how much each placement can be
   trusted, and the invented-data flag on any fabricated count or estimate.

The board owns exactly one catalog pattern: `kanban-lanes`. Everything else it
uses — `prompt-echo`, provenance pills, `owner-routing`, `source-ref-chip`,
`source-manifest`, `tldr-block`, the invented-data flag — belongs to other
owners and is used without re-marking.

## Interaction instructions

- Make every user-facing region annotatable: the request, the board, the
  hand-off, and the generated reply.
- Keep the board legible and usable without JavaScript. Cards render in their
  authored lanes, each selector shows its lane, and the drag layer is pure
  enhancement — the selectors alone can complete the triage.
- Treat the starting placement as a suggestion, never a decision. Untouched
  cards must not read as confirmed in the prompt.
- The page has exactly one live prompt and one **Copy prompt for LLM coder**
  control; it updates after every move, selector change, or saved note.
- Do not turn the board into a tracker. It produces a plan to paste back, so a
  user can reorder freely without consequence — say so on the board.

## Present

Compile the board to a self-contained file and hand that to the user; never
present a raw source directory. From the discover skill root:

```bash
scripts/build-artifact.ts examples/src/triage-board            # file:// document
scripts/build-artifact.ts examples/src/triage-board --artifact # Artifact fragment
```

The builder inlines the Tailwind runtime, `discovery.css`, and `discovery.js`,
and fails unless the output is genuinely self-contained. For a generated board,
write the source under the session workspace and build from there; discard the
workspace once the arrangement and notes are captured in the one reply.

The board is a direction sample, not a fixed schema. Change the lanes, the card
fields, and the surrounding evidence to fit the actual sort under review — but
keep placement as the answer, the keyboard selectors as a first-class path, and
the single generated reply intact.
