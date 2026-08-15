# Plan review direction

Before presenting the draft, verify it against
[Making plans](../../../../../references/directions/plan.md). Return an incomplete
plan to its author instead of asking the user to review missing foundations.

Use this direction when a drafted implementation plan is ready but its judgment
calls still need the user's confirmation or tweaks before anyone builds against
it. The plan is not the deliverable; the deliverable is the user's set of
answers to the calls the plan makes. Turn the plan into an interview — one
decision per step — rather than a document the user skims and approves out of
politeness.

This is reached from the `readiness` discovery mode when the verdict is "the
plan is ready to be reviewed," or by direct request ("review this plan,"
"walk me through the plan and let me tweak it," "which parts of this plan
should I push back on"). It adds no new discovery mode.

## When it fits

The plan already exists and is basically sound; what is unresolved is a handful
of judgment calls the author had to make to write it. The user is more likely to
change some calls than others, and reading a flat top-to-bottom plan buries the
two decisions that matter under ten that do not. If instead the plan itself is in
doubt — no viable approach yet, or competing whole approaches — use ranked
options or a readiness check first. Plan review assumes the shape is settled and
only the calls inside it are open.

## Information architecture

1. Show where the plan came from: the originating request, and the sources the
   author actually read to write it. The user judges the plan against its
   inputs before confirming anything.
2. Order the plan's steps by **tweak-likelihood**, most likely to change first,
   settled last — not by build order. Give every step a visible rank affordance
   so the sort is legible at a glance and never carried by colour alone.
3. Make every step an interview turn: the step's content with real code
   excerpts and file references, honest trade-offs where the call is material,
   and one decision — accept the recommendation, take the named alternative, or
   tweak it in a note.
4. For any step that changes a schema or a shared structure, let the choice
   rewrite a shared diagram in lockstep, so the consequence of the call is
   visible in the artifact rather than described in prose.
5. Show the build sequencing and the owner asks separately from the decisions —
   this is order-of-work, not a call the user has to make.
6. Disclose what the plan deliberately leaves out and where it is weakest, in
   the author's own voice.
7. Capture exactly one hand-off verdict: build as-is, build with the tweaks
   marked on the page, or take another pass. Every step answer and note rides
   into the one generated reply regardless of the verdict.

A realistic plan review usually needs four or more decision steps; a page with
one token step and a verdict is not a review. Reach for a rank chip, a shared
schema diagram, code excerpts, a trade-off block, a sequencing timeline, and a
scope-cut disclosure according to the actual plan — none is mandatory, and a
step with no genuine judgment call should be marked settled and kept short
rather than dressed up as a decision.

## Structural fidelity

The checked-in example is directional, not a page schema. Executors may add,
remove, combine, or redesign components for the clearest task-specific UX while
preserving these semantic requirements:

- steps are ordered by tweak-likelihood, and every step carries its rank;
- every step poses one genuine decision the user can accept, redirect, or tweak;
- a schema- or structure-affecting step shows the consequence of the choice in a
  shared, lockstep-updating diagram rather than only in prose;
- trade-offs are stated where a call is material, in the direction's own terms;
- fabricated figures are flagged as illustrative and never presented as
  measured; and
- the plan resolves to exactly one hand-off verdict that stays unresolved until
  the user touches it.

Do not copy source-site branding, copyright, prose, or ornamental framing.
Reference examples are inspiration for depth and information architecture only.

## Interaction instructions

- Make every user-facing section annotatable, including the plan frame, each
  step, the sequencing, the scope cuts, the verdict, and the generated reply.
  The per-section note is the "tweak it in your own words" path for every step.
- Use radios for a step's single call and for the singular hand-off verdict;
  use follow-up checkboxes for optional asks that are requests, not decisions.
- Treat a preselected recommendation as unresolved until the user interacts. An
  untouched step is a suggestion, not a confirmed call, and the generated reply
  must say so.
- The schema-linked choice is deterministic page-inline behaviour: the choice
  rewrites the flagged diagram rows with safe DOM APIs, and the recommended
  variant is the one that renders with no JavaScript.
- The page has exactly one live prompt and one **Copy prompt for LLM coder**
  control; it regenerates after every answer or saved note. Phrase it as
  implementation feedback to the coder — the user's calls on the plan — not as a
  restatement of the plan.
- Keep the whole plan readable without JavaScript, and keep the rank ordering
  legible through the pip scale, not colour alone.

## Present

Save the board before presenting it, then compile a self-contained copy with the
builder and present that file:

```bash
scripts/build_artifact.py examples/src/plan-review          # self-contained full document
scripts/build_artifact.py examples/src/plan-review --artifact  # head-less fragment for the Artifact tool
```

The builder inlines the Tailwind runtime plus `discovery.css` and `discovery.js`
so the page renders under a locked-down Artifact CSP. Never hand-edit the
compiled output — to change the board, edit the modular sources under
`examples/src/plan-review/` (the `page.html` shell plus `sections/NN-*.html`)
and re-emit the committed page with `--emit-page`. After the user's step answers,
verdict, and notes are captured in the one generated reply and transferred to the
ledger, discard the session workspace and any compiled artifacts.
