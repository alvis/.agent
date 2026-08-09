# Presenting discovery results

Use an interactive HTML review surface when visual relationships, comparison,
or in-context feedback will reduce ambiguity more than prose alone. HTML is not
the default and is never evidence by itself. The evidence ledger remains the
source of truth after answers and annotations are transferred back.

## Choose a directional action

| Discovery mode | Directional action    | Best fit                                                                |
| -------------- | --------------------- | ----------------------------------------------------------------------- |
| `blindspots`   | risk/context report   | Interacting risks, constraints, actors, or failure surfaces             |
| `blindspots`   | domain explainer      | An unfamiliar mechanism must become understandable before deciding      |
| `options`      | ranked options        | Viable approaches or experiential directions need in-context comparison |
| `options`      | brainstorm spectrum   | The user should react to a deliberately broad solution space            |
| `interview`    | guided interview      | Several coupled questions need visible supporting context               |
| `reference`    | semantics map         | Terms, relationships, or observable behavior must map into the target   |
| `prototype`    | interactive prototype | A disposable interaction is the cheapest useful probe                   |
| `readiness`    | readiness check       | Evidence, assumptions, blockers, and the next owner need one view       |
| `readiness`    | plan review           | A drafted plan's judgment calls need user confirmation before hand-off  |
| `readiness`    | change walkthrough    | A finished change needs to be genuinely understood before it merges     |

**Lifecycle actions.** plan-review, build-journal, and change-walkthrough serve
the plan → implementation → change lifecycle and are also reached by direct
request ("review this plan", "log the build deviations", "walk me through the
change"). plan-review is the interview-over-a-plan; guided-interview remains the
pre-planning interview. build-journal has no mode row because it is authored
during implementation rather than chosen as a discovery mode.

These actions are directions, not page schemas. Add, remove, reorder, combine,
or redesign components to deliver the clearest experience for the actual
information. Never preserve a component merely because an example contains it.
The shared annotation and single-prompt behavior is mandatory; visual recipes
and component counts are not.

Each action must nevertheless feel complete for its own job. Build from one
credible scenario and enough realistic data to expose the relevant trade-offs.
An action page is not complete when it merely places the catalog markers on a
few generic cards. Its core composition must let the user perform the action:
compare full directions, manipulate a prototype, traverse a mechanism, react
across a spectrum, answer an ordered interview, inspect source-to-target
semantics, evaluate risks, or reach a readiness verdict.

The approved [domain explainer](presentation/actions/domain-explainer.md) and
its [golden HTML example](../examples/html/domain-explainer.html) define the
shared visual hierarchy, responsive shell, annotation flow, and folded
single-prompt experience. Every action example follows that contract while
changing its content density and optional components to fit the action.

Together, the eleven action examples and four convention boards (specimen-board,
board-hub, architecture-board, triage-board) must cover the complete reusable
pattern catalog. Use the [presentation coverage map](presentation/coverage.md)
to see which action owns each demonstration. This is suite-level coverage:
generated pages still select only the components that improve their
task-specific UX. The complete validator checks both catalog coverage and
minimum semantic structure for every action; neither check substitutes for
rendered review.

## Variable length, modular sources

A board has no fixed shape. One single section demonstrating a component mockup
is a complete, valid page; a ten-plus-section implementation-direction review is
equally valid. Section count follows the information need, never the examples'
density. Any section type repeats 1..N — several decision sections, several file
cards — and the only per-page singleton is the generated-brief prompt host. The
sidebar quick-links are not hand-authored; the runtime derives them at run time
from the sections actually present.

Every board — including a generated user artifact — is authored as modular
sources: a `page.html` shell plus one file per section under `sections/`,
composed with `scripts/build_artifact.py`. Never author one giant HTML file, and
never reinvent the shell markup from scratch. Always start from the committed
starter scaffold `templates/src/page/` (its `page.html` shell plus starter
`sections/`): copy the whole directory into the session workspace, then fill its
`{{PLACEHOLDER}}` tokens and add, edit, reorder, or remove section files to fit
the action. The scaffold already carries the mandatory page shell, the
`@theme inline` block, the annotation hooks, and the single generated-prompt
host, so copying and editing it — rather than hand-writing equivalents — is what
keeps every board on the shared contract. An executor creating a temporary
review surface copies the scaffold into the session workspace, edits its
sources, composes it, then compiles the self-contained file.

## Shared interaction contract

Follow [components](presentation/components.md) for the declarative HTML hooks.
Every user-facing section must be annotatable, at two scopes from one dialog:
the whole section, and a passage the reader selects inside it. A selection note
carries its quote into the generated prompt, so a comment on one sentence
arrives attached to that sentence; both come from the shared runtime, and a
section neither re-implements nor opts out of them. Answers, decisions, optional
follow-up requests, overrides, and annotations regenerate one Markdown prompt
immediately. The page displays that prompt in one host and provides exactly one
control labelled **Copy prompt for LLM coder**. Do not add per-section prompt
copy actions. A separately labelled copy control for non-prompt material, such
as code, is allowed only when it cannot be mistaken for the generated reply.

Untouched defaults are suggestions, not user decisions. Record whether a
control was touched. Show suggested responses in the sidebar immediately; do
not fill empty lists with static explanatory strings. In the generated prompt,
distinguish confirmed recommendations, explicit overrides, optional or selected
follow-ups, unresolved suggestions, and free-form notes. User input always
outranks a recommendation. Do not manufacture a decision for an explanatory
page; it may contain only follow-up actions.

Use safe text APIs for user content. The page must remain legible when
JavaScript fails, storage is unavailable, or the clipboard API is blocked.
Persist only page answers and annotations in browser-local storage; fall back
to in-memory state without preventing review.

## Shared theme contract

Use Tailwind CSS utilities together with the shared `--ui-*` CSS variables.
The variables in `assets/html/discovery.css` are the only theme-value source;
the page's `@theme inline` block maps them into Tailwind names such as
`bg-canvas`, `text-ink`, and `bg-accent-soft`. Do not redefine color values in
an action page **outside the board-theme overlay**. Compose page-specific
layout and states with utilities, then use the shared component classes for
behavior-heavy patterns that would be noisy or fragile to repeat.

The board-theme overlay. Each page carries an optional `<style
data-board-theme>` head block — the one sanctioned place to re-point color for
the board at hand. Whitelisted tokens only: the `--ui-accent` set and the
semantic ramps `--ui-verdict-*`, `--ui-status-*`, `--ui-k-*` (the builder
rejects anything else, and rejects a redefinition that lacks either light or
dark values). Use it to give each board of a companion set its own accent so
the set reads as themed siblings, and to map the board's domain states —
go/stop verdicts, work statuses, finding categories — onto the ramps. Prefer
aliasing the shell's own families (`--ui-positive`, `--ui-insight`,
`--ui-provenance-amber`, `--ui-sev-critical`) over inventing hues; keep the
contrast floor in both themes.

The specimen exception. House `--ui-*` stays the default for page chrome, but
an embedded specimen or mockup should read as the subject product, not the tool.
Show its real palette in a scoped `[data-specimen]` container that re-points the
`--ui-*` tokens locally — the one place a hex literal may appear in an action
page — or expose parallel `--spec-*` tokens when the specimen must show house
and brand side by side. Re-point only the tokens the specimen needs; its
interior reuses the house component classes and renders brand-tinted. A
page-level re-tint outside `[data-specimen]` is allowed only through token
indirection (`--ui-accent: var(--ui-insight)`), never a hex literal. The tool's
annotation pin layer and browser-frame chrome stay on house tokens, outside the
specimen re-point, because they are the tool's layer rather than the product's.

These pages are temporary development artifacts, so the no-build Tailwind
browser runtime is appropriate. The shared stylesheet must still provide a
readable base when that runtime cannot load. Default to the light, daylight
theme; use an explicit `data-theme="dark"` for dark review rather than following
the host system automatically.

The shared visual direction is an empowering developer workspace with liquid
glass depth and the warm editorial grammar of the approved source reference:
a natural canvas, translucent layered surfaces, crisp code typography,
terracotta interaction energy, and restrained olive for insight. Glass supports
hierarchy rather than decorating every region; prose sections can remain open
on the canvas. Preserve readable fallback colors whenever `backdrop-filter` is
unavailable.

## Guided conventions and extensibility

Four optional conventions raise the honesty and depth of a review surface when
the content warrants them. Reach for [components](presentation/components.md)
for the exact hooks:

- provenance pills wire each claim's status from the evidence ledger, so the
  reader sees what is observed, inferred, assumed, decided, approved, or open;
- a "Trade-offs, honestly" block states the wins, costs, and failure modes of a
  direction, with an invented-data flag for illustrative filler;
- author annotation pins over a browser-frame specimen teach a mockup in place,
  distinct from the user's own Add-note mechanism;
- a multi-board hub links sibling boards by session-relative href.

Two things are standard rather than optional, because a reader needs them
whether or not the content warrants a convention. A run that produces more than
one board puts the **board set** in every board's docnav, not only on a hub —
the runtime hides the block below two entries, so a single-artifact run shows
nothing and the author does nothing differently. And a section explaining a
flow, pipeline, or state machine **draws it**: hand-authored SVG where the
drawing carries the claim, otherwise a Mermaid figure, with prose supporting the
diagram rather than replacing it.

The foundation is fixed: the page shell, annotatable sections, **per-card
response capture** (an option set with reasons and a badged recommendation
wherever a card carries a real decision with alternatives — never a bare
accept; an accept toggle for single-recommendation cards; a note affordance
per card; every response reflected on the card, in the docnav counters, and in
the live prompt), the single-prompt contract, the `--ui-*`/`@theme inline`
theme plus board-theme overlay rules, and these provenance, trade-off, pin,
and board conventions. `references/features.md` enumerates this floor as a
checklist with its validation mapping.

**Above that floor, design freely.** The component catalog is a reference
shelf of proven devices, not a completeness requirement, and the action
recipes are starting points, not prescribed section lists. Layout, section
shapes, devices, and interactions are the executor's design decisions, made
for the content at hand — approach each board like a design lead giving this
product its own treatment, not a form-filler. Bespoke section CSS and JS are
welcome when they style through the tokens and honor the floor; markup that
appears in no catalog entry is conforming as long as the floor holds. Guided,
not rigid — and never omit ledger content because no catalog pattern fits it;
give it a free-pattern section instead.

## Temporary artifact lifecycle

Always save generated, user-specific board sources before presenting them. Use
the platform temp root through Python's `tempfile.mkdtemp` to open one session
workspace, with sanitized slugs and a unique suffix:

```python
workspace_dir = tempfile.mkdtemp(
    prefix=f"essential-discover-{repo_slug}-session-"
)
```

One workspace holds every board produced during the session, so boards can
cross-link with session-relative hrefs (`./sibling.html`). This resolves through <!-- doc-path-gate: ignore -->
the operating system (`$TMPDIR` on macOS, the configured temp root such as
`/tmp` on Linux, and `%TEMP%` on Windows) without a shared filename collision.
Write each board's source directory and any captures inside that workspace, and
link boards to one another with relative hrefs. Board sources carry no external
or linked scripts and stylesheets — no CDN Tailwind tag, no `discovery.css` or
`discovery.js` link, no `{{DISCOVERY_*_URL}}` placeholder — only inline markup
and the inline `<style type="text/tailwindcss">` theme block; the builder
injects every shared asset. Artifacts stay ephemeral — durable, bookmarkable,
and cross-linked only within the session, never a permanent deliverable.

The presentation flow is always the same: copy the `templates/src/page/` starter
scaffold into the session workspace, edit its modular sources, compose them, and
compile a self-contained file with the builder before presenting it.

```bash
# self-contained full document (file:// viewing, any host)
scripts/build_artifact.py <board-source>
# head-less fragment ready to hand straight to the claude.ai Artifact tool
scripts/build_artifact.py <board-source> --artifact
```

The builder composes the `page.html` shell with its `sections/` files, then
inlines the Tailwind runtime plus `discovery.css` and `discovery.js`, and fails
the build unless the output is genuinely self-contained (no external
`src`/`href`, no unfilled placeholder, no raw U+FFFD byte — the last being the
sentinel the claude.ai Artifact deploy validator rejects). The Tailwind runtime
is downloaded latest-on-request by the builder, with a gitignored cache kept as
an offline fallback. The Mermaid runtime follows the same policy with one
difference: it is inlined **only** into a board that carries a `[data-mermaid]`
figure, because it is several megabytes. A board without a diagram weighs
exactly what it weighed before Mermaid existed; a board with one is knowingly
much heavier, and that is the trade the figure buys. Never hand-edit the compiled output; it is generated and
throwaway. To change styling or behaviour, edit the small sources and rebuild.
`--artifact` mode omits `<!doctype>/<html>/<head>/<body>` because the Artifact
tool supplies its own; the fragment restores only the source body's
`::selection` colours, since `discovery.css` styles the `body` element (and
`[data-theme="dark"]` on the root) directly.

Present the compiled file in this order:

1. the LLM coder's built-in local browser or HTML viewer;
2. a cloud artifact viewer/store only when a suitable tool exists and the
   content is safe to externalize (hand it the `--artifact` fragment);
3. a local browser such as Chrome.

Never externalize sensitive discovery content merely to satisfy the preference
order. After the user's decisions and annotations are captured in the one
generated prompt and transferred to the ledger, discard the whole session
workspace and any compiled artifacts.

## Golden-example confirmation

The domain-explainer example was explicitly approved after desktop and narrow
review. Treat it as the golden baseline for new action pages. Preserve its
right-side desktop navigation, bottom narrow navigation, shared button
language, section annotation dialog, live decision/note lists, and one folded
generated prompt. The action recipe remains directional: change, remove, or
add content components whenever that improves the task-specific UX.

Read the golden examples as a ceiling of craft to aspire to, not a floor to
clear. They deliberately showcase the system at full stretch — a complete
provenance table, every trade-off group, a richly illustrated specimen — so one
page can demonstrate the whole catalog at once. A generated page is not obliged
to match that density: fill only what its own artifact needs, and let the
showcase set the bar for polish and personality rather than hand you a checklist
of sections to reproduce. Matching the golden board's delight is the goal;
copying its inventory is the failure mode.

## Non-goals and routing

Some presentation types are deliberately not offered here. Each would break the
single-prompt or disposable-surface contract, so route it to its proper owner
instead.

| Not offered                                                    | Why it is out of scope                                                                                                    | Where it belongs                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Recurring status reports, incident postmortems                 | Backward-looking reporting is not discovery, and a disposable surface is the wrong home for a record meant to last.       | reporting / documentation flows |
| Design-system reference sheets                                 | A production design artifact is durable by definition, which the temporary-surface contract forbids.                      | `web:design`                    |
| Exportable asset sheets, client-side file downloads            | A file the user keeps is a durable deliverable, contradicting the discard-after-transfer contract.                        | a durable-artifact skill        |
| Durable config or prompt editors with state-serialized exports | The atoms exist — live previews, toggle rigs — but a board's one output is the single generated prompt, not a saved blob. | the single generated prompt     |
| Pre-authored per-card prompt fragments                         | A board exposes exactly one live prompt, so per-card prompt snippets are prohibited outright.                             | the single prompt host          |
