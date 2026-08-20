# Build journal direction

Use this direction during or right after implementation, when the running code
has already diverged from the plan and the user needs to triage each divergence
now rather than discover it later in review. The page is a chronological
plan-vs-reality log: it turns mid-build surprises — normally lost to the
scrollback — into inputs the user can accept, reopen, or hand off before the
change merges.

This is not a readiness gate and not a change walkthrough. A readiness check
asks whether work may begin; a build journal reports what already happened while
it was underway. Reach for it when the honest artifact is "here is where I went
off-plan and what I did about it," not "here is a finished diff to understand."

## Entry conditions

Reached from the `readiness` mode or by direct request — "log the build
deviations", "keep an implementation journal", "show me where you went off the
plan". No new discovery mode is added. Build a journal only when there is a real
plan to measure against and at least a few genuine deviations; a build that
matched its plan exactly does not need this surface, and a journal padded with
non-deviations reads as busywork.

## Information architecture

1. Frame the build: the plan it was measured against, the branch, the safe
   fallback, and a one-line count of what the log contains (entries, deviations,
   hand-offs). A short executive summary up top earns its place when the log is
   long.
2. Show the whole build in order. Reuse the milestone-timeline event variant as
   the spine, with a journal badge on each event keyed by
   `[data-journal-kind]`: plan-confirmed, discovery, deviation, todo-for-human.
   Plan-confirmed and discovery entries give the deviations their context; a log
   of only deviations hides how much went right.
3. Expand every deviation into a four-part labelled anatomy — **what the plan
   said**, **what the code revealed**, **the conservative choice**, **revisit?**
   — as visible fields, not prose the reader must reverse-engineer. The revisit
   field is a per-deviation decision question (accept the choice as shipped /
   reopen before merge), so each deviation is triaged individually.
4. Route the calls the build refused to make. An agent-authored human todo is a
   decision that is genuinely a product, policy, or cost judgment rather than an
   engineering one. Give each an owner and a due affordance, and say what the
   code does by default in the meantime so the todo never blocks the merge on
   its own.
5. Anchor every entry to a `file:line` source reference, so a claim about the
   code can be checked against the code.
6. Close with exactly one verdict — proceed to review, pause for the reopened
   revisits, or pause only on the hand-offs — and one generated reply that
   carries every accepted or reopened revisit, the verdict, and all annotations.

A realistic journal usually needs three or more real deviations and at least one
hand-off; it must not compress the build into a pass/fail badge with no
traceable choice behind each divergence.

## Composition

The build-journal example owns `build-journal`, `deviation-log`,
`journal-badge`, and `human-todo`; mark those where they are visibly
demonstrated. It reuses `milestone-timeline` (the spine), `owner-routing` (the
hand-offs), `source-ref-chip` (the anchors), `prompt-echo` and `source-manifest`
(the provenance of the log itself), and `rich-diff` with `syntax-tokens` (a
concrete before/after where a choice is easier shown than described) — all
without re-marking, per the coverage convention that a pattern is marked only on
its owner's board.

Section types repeat freely. The reference board carries one provenance section,
one timeline spine, one section per deviation, one hand-offs section, one
verdict, and the single generated-brief host; a generated page should use as
many deviation sections as it has real deviations and no more.

## Structural fidelity

The checked-in example is directional, not a schema. Preserve these semantic
requirements:

- every deviation shows all four labelled parts and carries its own accept /
  reopen question;
- discoveries and plan-confirmed steps are visibly distinct from deviations, not
  relabelled versions of them;
- at least one human todo names an owner and states the current default;
- every entry is traceable to a source reference; and
- the verdict stays unresolved until the user touches it, and untouched revisit
  defaults remain suggestions, not decisions.

Fabricated proportions, counts, and clock times carry `data-fabricated` with the
invented tag, so the coder never treats an illustrative shape as a measured rate.
Do not copy source-site branding, palette, or prose; reference examples inform
depth and information architecture only.

## Interaction instructions

- Make every user-facing section annotatable, including the spine, each
  deviation, the hand-offs, the verdict, and the generated reply.
- Use radios for each deviation's accept/reopen question and for the single
  final verdict; the runtime records `touched` independently of the shown value.
- Phrase the one generated prompt as implementation feedback to the LLM coder:
  which conservative defaults are accepted, which revisits to reopen, which
  hand-offs are the user's to decide, and the verdict — never a generic summary.
- The page has exactly one live prompt and one **Copy prompt for LLM coder**
  control; it updates after every answer or saved annotation.
- Keep the whole log readable without JavaScript; the timeline, anatomy fields,
  and diffs are all static markup.

## Present

Build journals are throwaway review surfaces. Compile the modular source into a
self-contained file and present that, never the raw source directory:

```bash
scripts/build-artifact.ts examples/src/build-journal            # file:// document
scripts/build-artifact.ts examples/src/build-journal --artifact # Artifact fragment
```

The builder inlines the Tailwind runtime plus `discovery.css`/`discovery.js` and
fails unless the output is genuinely self-contained. Edit the small sources
under `examples/src/build-journal/` and rebuild; never hand-edit the compiled
output. After the user's accepted revisits, reopened revisits, verdict, and
annotations are captured in the one generated prompt and transferred to the
ledger, discard the compiled artifact.
