# Change walkthrough direction

Use this direction when a change is finished but must be genuinely understood
before it merges. The deliverable is not the diff and not a summary of it — it is
the reviewer's verified grasp of what the change actually does, plus one merge
verdict. Turn the diff into an oriented tour with a comprehension gate, so "I
skimmed it" becomes "I can explain it," rather than a wall of hunks the user
scrolls past and approves.

This is reached from the `readiness` discovery mode when the verdict is "the
change is ready for a merge review," or by direct request ("walk me through this
change," "quiz me before I merge," "help me actually understand this diff"). It
adds no new discovery mode.

## When it fits

The change exists, compiles, and is basically done; what is unresolved is whether
the reviewer understands the non-obvious behaviors well enough to own them in
production. A change earns this direction when a plain diff would hide the parts
that matter — a subtle collapse rule, a deliberately withheld side effect, a
partial index — behind the parts that do not. If instead the change does not
exist yet, or competing whole approaches are still open, use plan review or
ranked options first. If reality has already diverged from the plan during the
build, use the build journal. Change walkthrough assumes the code is settled and
only the reviewer's comprehension is open.

## Information architecture

1. Lead with a change frame: what the change does in one honest sentence, a
   version-control header (repo, branch → target, +/− stats, author), and a
   short read-this-first summary that names the non-obvious behaviors up front.
   The user should know where to spend attention before opening a file.
2. Tell the change story as a small keyboard-navigable deck — a few slides that
   move from the problem, to the mechanism, to the edge that bites — so the
   reader carries a mental model into the diff. The deck must read as a plain
   scrolled list without JavaScript and under reduced motion.
3. Tour the files in a curated **risk order**, highest-risk first, with a jump
   map that keeps each file's risk visible. Each file card carries a real
   `rich-diff` excerpt, and the files that decide behavior carry
   severity-labelled reviewer comments anchored to specific rows — the notes a
   diff skim would never surface.
4. Gate comprehension with two or more questions, each about a decision the user
   would have to make correctly during an incident, each with an explanation
   revealed on answer and anchored back to a file and line. The gate feeds the
   reply as understanding evidence; it is not a lock on the merge.
5. Capture exactly one merge verdict: approve as-is, approve with the follow-ups
   noted, or request changes — with room to say specifically what must change.
   Every comprehension answer and saved note rides into the one generated reply
   regardless of the verdict.

A realistic walkthrough usually needs three or more file cards and at least two
genuine comprehension questions; a page with one card and a verdict is not a
review. Reach for the version-control header, the story deck, the risk-ordered
file tour, diff comments, and the quiz gate according to the actual change — none
is mandatory, and a purely mechanical file with no non-obvious behavior should be
a low-risk card with a short diff rather than dressed up with comments it does not
need.

## Structural fidelity

The checked-in example is directional, not a page schema. Executors may add,
remove, combine, or redesign components for the clearest task-specific UX while
preserving these semantic requirements:

- files are toured in a curated risk order, and every file card carries a visible
  risk level that never rests on colour alone;
- the behavior-deciding rows carry severity-labelled comments anchored to a
  specific file and line, not generic praise;
- the comprehension gate asks real questions with explanations that trace back to
  the diff, and it informs rather than blocks the merge;
- the change story is fully readable as a scrolled list without JavaScript;
- fabricated figures — line counts, commit totals, volume metrics — are flagged
  as illustrative and never presented as a measured diff; and
- the change resolves to exactly one merge verdict that stays unresolved until
  the user touches it.

Do not copy source-site branding, copyright, prose, or ornamental framing.
Reference examples are inspiration for depth and information architecture only.

## Interaction instructions

- Make every user-facing section annotatable, including the change frame, the
  story deck, the file tour, the comprehension gate, the verdict, and the
  generated reply. The per-section note is where the reviewer records a concern a
  radio cannot capture.
- Treat the comprehension questions as understanding evidence: mark them as
  follow-up responses so an untouched question is never mistaken for an answer,
  and reveal each explanation through a native disclosure that works without
  JavaScript.
- Use radios for the singular merge verdict; treat a preselected recommendation
  as unresolved until the user interacts, and let the generated reply say so.
- The jump map is plain in-page anchors and the diff comments are static markup,
  so the whole tour navigates and reads with no JavaScript; the deck's key
  navigation and the annotation UI are progressive enhancement over that base.
- The page has exactly one live prompt and one **Copy prompt for LLM coder**
  control; it regenerates after every answer or saved note. Phrase it as the
  reviewer's verdict and what they verified — implementation feedback to the
  coder — not as a restatement of the diff.

## Present

Save the board before presenting it, then compile a self-contained copy with the
builder and present that file:

```bash
scripts/build-artifact.ts examples/src/change-walkthrough          # self-contained full document
scripts/build-artifact.ts examples/src/change-walkthrough --artifact  # head-less fragment for the Artifact tool
```

The builder inlines the Tailwind runtime plus `discovery.css` and `discovery.js`
so the page renders under a locked-down Artifact CSP. Never hand-edit the
compiled output — to change the board, edit the modular sources under
`examples/src/change-walkthrough/` (the `page.html` shell plus
`sections/NN-*.html`) and re-emit the committed page with `--emit-page`. After the
user's comprehension answers, verdict, and notes are captured in the one
generated reply and transferred to the ledger, discard the session workspace and
any compiled artifacts.
