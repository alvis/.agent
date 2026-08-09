# Shared HTML components

The component system is a small declarative contract implemented by
`assets/html/discovery.css` and `assets/html/discovery.js`. It makes temporary
discovery pages consistent enough to learn quickly without turning the examples
into rigid templates.

**This catalog is a reference shelf, not a ceiling.** Beyond the mandatory
floor (`references/features.md`: page shell, annotatable sections, per-card
response capture, single prompt host, token-only theming, dual theme, a11y,
self-containment), every pattern here is an option to reach for when the
content calls for it — never a completeness requirement. Markup that appears
in no catalog entry is conforming as long as the floor holds. When ledger
content fits no pattern, present it anyway in a **free-pattern section**: a
plain annotatable `[data-discovery-section]` with bespoke, token-styled
markup. Never omit content to satisfy the catalog.

The styling strategy is Tailwind CSS plus shared CSS variables. Load the
temporary browser runtime, map `--ui-*` values through `@theme inline`, and use
the resulting utilities for composition. Keep palette, type, shadow, and surface
values centralized in `discovery.css`; action examples must not create competing
theme tokens.

Use `backdrop-blur-lg` through `backdrop-blur-2xl` only on elevated controls,
decision surfaces, annotation UI, and the generated-prompt host. Pair the blur
with translucent `--ui-glass*` surfaces and inset highlights. Do not add opaque
card borders around glass, and do not turn every prose section into a glass
panel.

## Mandatory page shell

Use one root with a stable ID, action, and goal:

```html
<main
  data-discovery-page
  data-page-id="release-mechanics-v1"
  data-discovery-action="domain-explainer"
  data-discovery-goal="Choose a safe migration approach"
>
  <!-- adaptable page content -->
</main>
```

The runtime uses `essential.discover.v1:<page-id>` for local state. Generated
temporary previews should include a run-specific page ID so separate previews
cannot recover one another's answers accidentally.

Start by copying the modular starter scaffold `templates/src/page/` (its
`page.html` shell plus starter `sections/`) into the session workspace — never
hand-write this shell — then inspect the approved
`examples/html/domain-explainer.html`. The top bar contains no search control:
each artifact is one static page. On wide viewports, place navigation on the
right while keeping the reading column optically centered; move navigation
below the content on narrow viewports. The navigation owns live decision and
note groups: each label and count share a header row, and every current item is
listed beneath it. Untouched recommendations appear immediately as suggested
items; touched answers replace their suggested state. Do not hard-code empty
messages or collapse multiple items into a single summary.

## Annotatable section

Wrap every user-facing content region in a section with a unique identifier:

```html
<section data-discovery-section data-section-id="migration-sequence">
  <p class="discovery-eyebrow">Mechanism</p>
  <h2>Four changes, one reversible sequence</h2>
  <p>Section content remains readable before JavaScript adds annotation UI.</p>
</section>
```

The shared runtime inserts one **Add note** control and an annotation summary in
each section. It reuses one dialog/editor for the whole page. Do not hand-code
separate editors, and never insert annotation text with `innerHTML`.

Annotation is scoped two ways from that one dialog. A note taken with nothing
selected belongs to the whole section. Selecting text inside a section arms the
passage instead: a floating **Annotate** pill appears at the end of the
selection, the section's own trigger re-labels to **Note on selection**, and
<kbd>n</kbd> opens the dialog with the passage quoted above the note field.
Selection notes are stored separately from the section note and reach the single
generated prompt nested under it, so the reply says which words each comment was
about. This is shell behavior; sections get it for free and must not
re-implement it.

## Variable sections and generated navigation

A board carries **1..N** annotatable sections, and **any section type may
repeat**. Several decision-question sections, several mapping, file-review, or
deviation sections, several finding sections — all are legal on any action.
There is no fixed section set and no fixed count. Section ids are per-instance
identifiers, not slots: keep each `data-section-id` unique within the page, but
choose them to describe the instance. The **only** per-page singleton is the
generated-brief prompt host (see [Prompt host](#prompt-host)); everything else
is repeatable.

The sidebar quick-links are **not hand-authored**. The shell ships one empty
container and the runtime fills it from the sections actually present, so the
navigation always mirrors the page and never drifts:

```html
<nav class="essential-docnav">
  <div data-section-nav></div>
  <!-- runtime writes one #-anchor link per [data-discovery-section] here -->
</nav>
```

`buildSectionNav()` walks the sections in document order and writes one link per
region into `[data-section-nav]` with safe DOM APIs (never `innerHTML`). Each
link's label is the section's `data-section-label`, falling back to its first
heading, then a humanized `data-section-id`; the href is the section's element
id (or `data-section-id`). The generated-brief prompt host is skipped because it
is reached through the folded-prompt control instead. The nav is built before
the anchor-flash and active-tracking handlers bind, so every generated link is
wired exactly once. Do not enumerate section anchors by hand, and do not leave
stale `#anchor` links in the container.

Sources and shells **never link scripts or stylesheets** — no CDN Tailwind tag,
no `discovery.css` link, no `discovery.js` script, no `{{DISCOVERY_*_URL}}`
placeholder, external or relatively linked. Keep only the inline
`<style type="text/tailwindcss">` theme block. `scripts/build_artifact.py`
injects the Tailwind runtime plus discovery.css/js into the final files; a
source that references any asset is rejected by both the builder and the
validator.

## Decision question

Questions need stable IDs and human-readable labels. Recommended defaults may
be checked initially, but are unresolved until touched:

```html
<fieldset
  data-discovery-question
  data-question-id="rollout-speed"
  data-question-label="Preferred rollout speed"
>
  <legend>How quickly should traffic move?</legend>
  <label>
    <input
      type="radio"
      name="rollout-speed"
      value="Measured stages"
      data-recommended="true"
      checked
    />
    Measured stages <span>Recommended</span>
  </label>
  <label>
    <input type="radio" name="rollout-speed" value="One coordinated cutover" />
    One coordinated cutover
  </label>
</fieldset>
```

Use radios for one choice, checkboxes for independent choices, selects for
compact known sets, and text inputs only when recognition-based choices are not
enough. The runtime records `touched` independently from the current value.

Not every response is a decision. An explainer may instead offer optional
follow-up actions such as “show another example” or “go deeper on the failure
path.” Mark those question containers explicitly:

```html
<fieldset
  data-discovery-question
  data-question-id="explainer-follow-ups"
  data-question-label="Explain next"
  data-response-kind="follow-up"
>
  <legend>What should the coder explain next?</legend>
  <label
    ><input type="checkbox" value="Show a worked rollback" />Rollback</label
  >
</fieldset>
```

Omit decision questions entirely when the action does not require a choice.
The sidebar label and generated prompt adapt to decision-only, follow-up-only,
and mixed pages. An untouched optional follow-up is never treated as a request.

## Direction frame and trait reactions

When the user must choose a product, technical, visual, or interaction
direction, compare complete alternatives under one shared scenario. The hooks
below describe the decision semantics; they do not prescribe card styling or a
single composition:

```html
<main
  data-discovery-page
  data-page-id="review-queue-directions-v1"
  data-discovery-action="ranked-options"
  data-discovery-goal="Choose a direction for the review queue"
  data-scenario-id="review-queue-at-peak-load-v1"
>
  <section
    data-discovery-section
    data-section-id="dense-console"
    data-option-frame
    data-scenario-id="review-queue-at-peak-load-v1"
    data-direction-id="dense-console"
    data-direction-composition="operations-console"
  >
    <div data-direction-artifact>
      <!-- Render the representative interface, flow, model, or mechanism. -->
      <div data-direction-trait="metric-strip">Queue health at a glance</div>
      <div data-direction-trait="inline-triage">Resolve work in place</div>
    </div>
    <fieldset
      data-discovery-question
      data-question-id="dense-console-reaction"
      data-question-label="Dense console reaction"
      data-option-reaction
    >
      <legend>What should survive from this direction?</legend>
      <label>
        <input
          type="radio"
          name="dense-console-reaction"
          value="Keep the whole direction"
          data-reaction-kind="keep"
        />
        Keep the whole direction
      </label>
      <label>
        <input
          type="radio"
          name="dense-console-reaction"
          value="Steal the metric strip"
          data-reaction-kind="steal"
        />
        Steal the metric strip
      </label>
      <label>
        <input
          type="radio"
          name="dense-console-reaction"
          value="Reject this direction"
          data-reaction-kind="reject"
        />
        Reject this direction
      </label>
    </fieldset>
  </section>

  <!-- Render two to four more materially different direction frames. -->

  <fieldset
    data-discovery-question
    data-question-id="final-direction"
    data-question-label="Final direction"
    data-final-selection
  >
    <legend>Which direction should anchor the next iteration?</legend>
    <label>
      <input
        type="radio"
        name="final-direction"
        value="Dense console"
        data-direction-choice="dense-console"
      />
      Dense console
    </label>
  </fieldset>
</main>
```

Use three to five frames. Repeat the root `data-scenario-id` on every frame so
the content, inputs, operating state, and viewport remain controlled. Give each
frame a unique `data-direction-id` and `data-direction-composition`, one
substantive `data-direction-artifact`, and at least two visible named
`data-direction-trait` elements. Every frame needs local keep, steal, and reject
reactions; every stable direction ID needs exactly one matching
`data-direction-choice` in the final selection.

`data-direction-artifact` is also the shared responsive container. Compose its
interior with `discovery-direction-stats`, `discovery-direction-flow`, or
`discovery-direction-columns` plus one of
`discovery-direction-columns-two`, `discovery-direction-columns-three`,
`discovery-direction-columns-main-aside`, or
`discovery-direction-columns-aside-main`. These components respond to the artifact's available
width rather than the browser viewport, so a wide browser with a title rail and
sidebar cannot force a five-column layout into a narrow frame. Keep every grid
child at `min-width: 0`; long code, metrics, and labels must wrap inside the
artifact border.

For visual or interaction directions, render the same representative content
and state while changing hierarchy, density, controls, navigation, or
interaction model. For technical directions, hold inputs and constraints steady
while changing mechanism, ownership, or failure behavior. A renamed clone, a
moodboard swatch, or prose-only card is not a direction frame. The executor
should add or remove tables, flows, prototypes, diagrams, and controls to make
each direction honestly inspectable.

## Prompt host

Every page contains exactly one host and one prompt copy control:

```html
<section data-discovery-section data-section-id="generated-brief">
  <h2>Your reply to the coder</h2>
  <textarea data-discovery-prompt-host readonly></textarea>
  <button type="button" data-copy-generated-prompt>
    Copy prompt for LLM coder
  </button>
</section>
```

The runtime regenerates one Markdown prompt from the discovery goal, touched
answers, accepted recommendations, overrides, unresolved suggestions, and all
section annotations. It updates on every relevant `input` or `change` event.
There is no prompt per card, section, answer, or note.

The runtime moves this section into the navigation's folded prompt target when
JavaScript runs. Keep it in the main document in source so the page remains
readable without JavaScript. The fold is collapsed initially, and its textarea
grows to its content rather than creating a nested scrollbar.

## Optional presentation components

Use only what improves the page:

- context rail for a short mental model or glossary;
- sequence or flow for ordering and causality;
- comparison table for repeated fields;
- recommendation marker that remains visibly provisional;
- evidence or caveat strip for provenance and limits;
- status or readiness indicator for a single verdict;
- code/sample block with a separately labelled **Copy code** action;
- sticky table of contents for long pages;
- clear-state action near the generated prompt.

The executor may replace any optional component, including every component in
an example. Preserve semantic elements, keyboard reachability, visible focus,
44px touch targets, reduced-motion behavior, light/dark readability, and the
mandatory annotation/single-prompt contract.

## Provenance pills

When claims on a page carry different evidentiary weight, mark each one with its
status so the reader never mistakes an assumption for an observation. Pills are
author-time static: the skill writes `data-provenance` from the evidence ledger
while authoring the page. There is no ledger reader in the browser, and the
visible label is author-provided so the status is legible without JavaScript.
The runtime only gives each pill an accessible name and collects every claim
into a generated-prompt section, so a pill renders correctly before scripts run.

Use the inline form for a claim inside prose or a heading. For a table whose
every row carries one status, either mark the row itself with
`tr[data-provenance]` or place an inline pill in a cell — both forms are
allowed:

```html
<p>
  Peak queue depth reached 1,240 items
  <span class="discovery-provenance" data-provenance="observed">observed</span>
</p>

<!-- row-level form -->
<tr data-provenance="assumed">
  <td>Retry storms double write load</td>
  <td>assumed</td>
</tr>

<!-- or an inline pill inside a cell -->
<tr>
  <td>Retry storms double write load</td>
  <td>
    <span class="discovery-provenance" data-provenance="assumed">assumed</span>
  </td>
</tr>
```

The `data-provenance` value derives from the ledger's `Kind` — except
`approved`, which derives from the separate `Disposition` column (an approved
decision), so "wired from the ledger" stays honest:

| Ledger source          | data-provenance | Visible label | Colour intent                              |
| ---------------------- | --------------- | ------------- | ------------------------------------------ |
| Kind `observed`        | observed        | observed      | olive/insight (`--ui-insight`)             |
| Kind `inference`       | inferred        | inferred      | amber                                      |
| Kind `assumption`      | assumed         | assumed       | dashed grey / muted                        |
| Kind `intent`          | decided         | decided       | terracotta accent (`--ui-accent`)          |
| Kind `unknown`         | open            | open question | dotted / question, distinct from assumed   |
| Disposition `approved` | approved        | approved      | strong solid accent, emphasis over decided |

`open` must stay visibly distinct from `assumed` — dotted versus dashed plus a
question affordance. Style by attribute (`[data-provenance="..."]`) on both
`.discovery-provenance` and `tr[data-provenance]`; new tokens keep the `--ui-*`
naming, and no bare hex appears in the action page. The runtime collects each
claim into a `## Provenance of claims` prompt section placed after
`## Review context`.

## Trade-offs, honestly

When a page recommends or explains a direction, state its costs alongside its
wins so the reader can weigh it without reverse-engineering the omissions. The
block names what the direction earns, what it charges, and where it breaks:

```html
<aside class="discovery-tradeoffs" data-tradeoffs-honestly>
  <h3>Trade-offs, honestly</h3>
  <div data-tradeoff-group="wins">
    <h4>Wins</h4>
    <ul>
      <li>Cuts median triage time roughly in half</li>
    </ul>
  </div>
  <div data-tradeoff-group="costs">
    <h4>Costs</h4>
    <ul>
      <li>Adds a queue service to operate and page on</li>
    </ul>
  </div>
  <div data-tradeoff-group="fails-when">
    <h4>Fails when</h4>
    <ul>
      <li>Bursts exceed worker capacity for minutes at a time</li>
    </ul>
  </div>
  <!-- optional -->
  <div data-tradeoff-group="scale-posture">…</div>
  <div data-tradeoff-group="data-notes">…</div>
</aside>
```

The `wins`, `costs`, and `fails-when` groups are required when the block is
present; `scale-posture` and `data-notes` are optional. Group labels are
visible. The runtime collects the block into a `## Trade-offs surfaced` prompt
section.

Any element holding fabricated illustrative data carries the invented-data flag,
so the coder never treats filler as real:

```html
<td data-fabricated>
  1,240
  <span class="discovery-invented-tag" data-invented-tag>invented</span>
</td>
```

`data-fabricated` is the semantic hook and `.discovery-invented-tag`
`[data-invented-tag]` is the visible, author-provided marker; it applies
anywhere — tables, stat strips, or a specimen. When any `data-fabricated`
element exists, the runtime appends a one-line note to the prompt that
illustrative data is invented.

## Author annotation callouts (pins + browser-frame chrome)

To teach a specimen in place, number author pins over a browser-framed mockup
and pair each with a **callout card** that carries the note text inline, so the
annotation is legible ON the board rather than reduced to a bare number. These
are distinct from the user's own Add-note mechanism (`data-annotation-for`,
`data-annotation-summary`, `data-annotation-trigger`, `data-annotation-dialog`,
`data-annotation-input`); both coexist, and author pins must not reuse those
names. The pin layer is a sibling overlay outside `[data-specimen]`, so the
specimen's brand re-point does not recolour the tool's teaching pins — the layer
stays on house `--ui-*`:

```html
<div class="discovery-annotated-specimen">
  <div class="discovery-artifact-frame" data-browser-frame>
    <div class="discovery-artifact-bar">
      <span class="discovery-artifact-dots" aria-hidden="true"></span>
      <span class="discovery-artifact-url">app.example.com/orders</span>
    </div>
    <div data-specimen>…the mockup…</div>
    <div class="discovery-pin-layer" data-annotation-pins>
      <button
        class="discovery-pin"
        data-annotation-pin="1"
        style="--pin-x:34%;--pin-y:52%"
        aria-describedby="pin-note-1"
      >
        1
      </button>
    </div>
  </div>
  <!-- Callout cards: OUTSIDE the frame, so the pin layer (inset:0) maps to the
       frame and pins never drift onto the cards. -->
  <ol class="discovery-pin-notes">
    <li class="discovery-pin-note" data-pin-note="1" id="pin-note-1">
      <strong>Inline triage.</strong> Work resolves without leaving the row
      <span class="discovery-provenance" data-provenance="decided">decided</span
      >.
    </li>
  </ol>
</div>
```

Pins are numbered `1..n`, absolutely positioned by the `--pin-x`/`--pin-y`
percentage custom properties, and are real `<button>` elements with a minimum
44px touch target. Each callout card leads with an inline numbered badge (the
`::before` on `.discovery-pin-note`, drawn from `data-pin-note`), so card `N`
reads as the same annotation as pin `N`. Cards lay out in a two-up grid directly
below the mockup (`.discovery-pin-notes` goes two-column at ≥34rem); they carry
the note prose and a provenance pill, matching the honesty conventions elsewhere.

**No drawn leader line — by decision.** The pin↔card tie is the shared number
plus a synchronized highlight: on focus or hover of either, the runtime toggles
`.is-active` on the whole pair via `classList` (the DESIGN.html annotated-code
idiom). A drawn connector is deliberately avoided because a line to an _interior_
pin cannot reach it without crossing the very mockup it annotates, which would
occlude the design; adjacency + number + mutual highlight carry the relationship
without that cost. This is the intended, ruled design — not a stopgap for a line
that could not be drawn — so do not "restore" leader lines later: for any pin set
with interior pins the line would occlude, and the highlight tie is preferred.
This author-pin behaviour is separate from the user Add-note dialog and must not
merge with it.

**Invariants.** Keep `data-annotation-pin` count equal to `data-pin-note` count
(one card per pin), keep the `<ol class="discovery-pin-notes">` a sibling of —
not a child of — `[data-browser-frame]`, and reference each card from its pin's
`aria-describedby`.

## Multi-board hub

When a session produces several boards, give every board root a stable
`data-board-id` and let one hub board link the siblings by session-relative
href, so a reader can move between boards that live in the same workspace:

```html
<main
  data-discovery-page
  data-page-id="review-queue-hub-v1"
  data-discovery-action="board-hub"
  data-discovery-goal="Navigate the review-queue boards"
  data-board-id="board-hub"
>
  <section data-discovery-section data-section-id="board-index" data-board-hub>
    <ul class="discovery-board-index" data-board-index>
      <li>
        <a
          class="discovery-board-link"
          data-board-link="specimen-board"
          href="./specimen-board.html"
          >Brand specimen board</a
        >
      </li>
      <li>
        <a
          class="discovery-board-link"
          data-board-link="board-hub"
          href="./board-hub.html"
          aria-current="page"
          >Hub</a
        >
      </li>
    </ul>
  </section>
</main>
```

Every board root carries `data-board-id`; the hub section carries
`data-board-hub`; the index list is `.discovery-board-index`
`[data-board-index]`; each link is `.discovery-board-link`
`[data-board-link="<board-id>"]`. Mark the current board with
`aria-current="page"`. Hrefs are session-relative (`./sibling.html`) and valid <!-- doc-path-gate: ignore -->
only because every board lives in one session workspace. The runtime includes
the board id in the generated prompt's review context.

## Board set (docnav index)

A hub board is optional; the sidebar board set is not. Whenever a run produces
more than one board, **every** board carries the same list in its docnav, so a
reader can leave any board without first finding the hub. The starter scaffold
ships the block; authoring it means writing one `<li>` per board produced, in
reading order, including the board being authored — **once for the whole run**,
in `<run-root>/_shared/board-set.html`:

```html
<li>
  <a
    class="essential-board-link"
    data-board-link="signature-board"
    href="./signature-board.html"
    >Signature workstream</a
  >
</li>
```

Every board's `page.html` then names that file rather than carrying its own
copy, and `build_artifact.py` rewrites the line from the partial at compose
time:

```html
<div class="essential-docnav-rule" data-board-set-rule hidden></div>
<p data-board-set-heading hidden>Board set</p>
<ul class="essential-board-set" data-board-set hidden>
  <!-- {{INCLUDE: _shared/board-set.html}} -->
</ul>
```

The include path is relative to the run root — the directory holding every
board source — so a path that escapes it is refused, as is an include inside the
partial itself. Pasting the entries into a page instead is the one thing this
forbids: the same labels, ids, and hrefs would then have to be patched
independently on every board, and the copies drift the first time a board is
added or renamed.

The runtime marks the entry matching this page's `data-board-id` (falling back
to `data-page-id`) with `aria-current="page"` and reveals the heading, rule, and
list only at **two or more** entries. So never hand-set `aria-current` — an
author copying a board between runs gets it wrong, and the runtime cannot — and
leave the list empty on a single-artifact run, which then shows nothing at all.
The `[data-board-hub]` section above is a different device: a content section
that indexes the boards with descriptions. The docnav block is the standard; the
hub section is for a run that wants a landing page as well.

## Column density by content kind

Card grids size their columns by the **kind of content** in them, not by a
number the author picks. `.discovery-card-grid`, `.discovery-finding-grid`,
`.discovery-variant-gallery`, and `.discovery-avatar-options` all resolve
`--grid-col` from one scale:

| Density   | Column floor | Content it is for                                |
| --------- | ------------ | ------------------------------------------------ |
| `tile`    | 8rem         | a number and a label: counters, stat tiles        |
| `compact` | 14rem        | a short label and one line — the default          |
| `prose`   | 22rem        | a heading and a sentence or two: findings, claims |
| `wide`    | 30rem        | code, tables, multi-paragraph bodies              |

`prose` is 22rem because ~352px less card padding is roughly 55ch at the
board's body size, inside the readable 45–75ch measure; the 14rem default is
~28ch, which is what collapses a finding card into four-word lines.
`.discovery-finding-grid` therefore defaults to `prose` — a finding always
carries a claim. Override per block on the grid element itself:

```html
<div class="discovery-card-grid" data-grid-density="prose">
  <article class="discovery-finding-card">…</article>
</div>
```

Choose the density from what the card holds. A grid of counters set to `prose`
wastes the row as badly as a grid of claims set to `tile` cramps it.

## Mermaid diagram

A section that explains a flow, a pipeline, or a state machine says it in a
diagram; prose is the fallback, not the default. Hand-author inline SVG
(`node-edge-diagram`) when the drawing itself carries the claim — layered
architecture, an annotated blueprint. Write Mermaid when the diagram merely
records order or structure:

```html
<figure class="discovery-mermaid" data-mermaid>
  <pre data-mermaid-source>
sequenceDiagram
    participant C as Client
    participant S as Service
    C->>S: submit op
    S-->>C: ack
  </pre
  >
  <div data-mermaid-host></div>
  <figcaption>Order of one write through the service.</figcaption>
</figure>
```

The figure carries `data-mermaid`, the definition lives in
`[data-mermaid-source]`, and `[data-mermaid-host]` is empty. Never name a color:
the runtime initializes Mermaid's `base` theme from the live `--ui-*` tokens, so
a diagram inherits this board's accent and re-renders on a theme flip. A
definition that fails to render stays visible with the error beside it rather
than vanishing with the section's explanation.

`data-mermaid` is also the build marker: `build_artifact.py` inlines the Mermaid
runtime only into a board that carries one, because that runtime is several
megabytes. A diagram-free board is byte-identical to what it was before Mermaid
existed. Mermaid v11 resolves its diagram types statically, so a `file://` board
is self-contained; the builder rejects a runtime containing a dynamic `import()`
rather than shipping a board that fails only once opened.

## Scoped specimen

An embedded specimen re-points house tokens locally in a `[data-specimen]`
container so the mockup reads as the subject product rather than the tool. This
is the one documented place a hex literal may appear in an action page, and only
inside `[data-specimen]`; page chrome, the pin layer, and the browser-frame
chrome stay on house `--ui-*` tokens. See the specimen exception in
[presentation](../presentation.md) for the token rules.

## Synchronized pairs (shared highlight idiom)

Several patterns tie two on-page elements together so that hovering or focusing
either one lights up the other. They all share one runtime primitive:
`installSyncGroup(members)` keys elements by a shared id and toggles `.is-active`
on every member of a key when any member is engaged (the same `classList` idiom
as the author-pin ↔ callout tie). The author supplies matched `data-*` ids; no
per-pattern JavaScript is needed. Three catalog patterns use it directly:

```html
<!-- code-pair-highlight: matched regions across two side-by-side code panels.
     Every id appears exactly twice — once per panel. -->
<pre class="discovery-light-code">
  <span data-code-pair="ack-record">arrival.record(seq)</span>
</pre>
<pre class="discovery-light-code">
  <span data-code-pair="ack-record">recordArrival(seq)</span>
</pre>

<!-- glossary-sync: inline term <-> glossary entry. -->
<p>
  Keep <span data-term="dual-write">dual writing</span> until backfill lands.
</p>
<dl class="discovery-glossary">
  <dt data-term-def="dual-write">Dual write</dt>
  <dd>Write both shapes until the read switch flips.</dd>
</dl>

<!-- specimen-code-map: a specimen region <-> the code that produces it. -->
<div data-code-map="metric-strip">Queue health at a glance</div>
<pre
  data-code-map-target="metric-strip"
><code>&lt;MetricStrip depth={depth} /&gt;</code></pre>
```

Mark the visible demonstration with `data-presentation-pattern="code-pair-highlight"`,
`"glossary-sync"`, or `"specimen-code-map"` on the container that carries the
paired regions. Members become focusable automatically, so keyboard users get
the same tie.

## Code presentation

**Syntax tokens.** Colour source excerpts with author-applied spans, no
highlighter runs in the browser. The six token classes
`discovery-tok-kw|str|cm|fn|num|type` map to new `--ui-tok-*` values legible on
both the dark `.discovery-code-annotation` surface and the light
`.discovery-light-code` panel. Mark the token-bearing `<pre>`:

```html
<pre class="discovery-light-code" data-presentation-pattern="syntax-tokens">
<span class="discovery-tok-kw">func</span> <span class="discovery-tok-fn">Ack</span>(seq <span class="discovery-tok-type">uint64</span>) {
  <span class="discovery-tok-cm">// contiguous only</span>
  cursor.commit(<span class="discovery-tok-num">1</span>, <span class="discovery-tok-str">"ok"</span>)
}
</pre>
```

**Rich diff.** Upgrade `.discovery-diff` with an optional hunk header row
(`.discovery-diff-hunk`), gutter line numbers (`data-line`), deletion
strikethrough (`<del>` inside an `.is-removed` row), and `syntax-tokens` inside
the rows:

```html
<div class="discovery-diff" data-presentation-pattern="rich-diff">
  <div class="discovery-diff-hunk">
    @@ replay.ts · replayTo() — lines 41–43 @@
  </div>
  <div class="is-removed" data-line="41">
    <del>− <span class="discovery-tok-kw">await</span> cursors.seek(x)</del>
  </div>
  <div class="is-added" data-line="41">
    + <span class="discovery-tok-fn">assertRetained</span>(requested)
  </div>
</div>
```

**Code tabs.** A tabbed multi-representation panel. The runtime (`installCodeTabs`)
owns `aria-selected`, panel `hidden`, and a roving tabindex; arrow / Home / End
move between tabs. Keep tab count equal to panel count:

```html
<div
  class="discovery-code-tabs"
  data-code-tabs
  data-presentation-pattern="code-tabs"
>
  <div role="tablist">
    <button role="tab" data-code-tab="go" aria-selected="true">
      Go source
    </button>
    <button role="tab" data-code-tab="ts" aria-selected="false">
      TS proposal
    </button>
  </div>
  <div role="tabpanel" data-code-panel="go"><pre>…</pre></div>
  <div role="tabpanel" data-code-panel="ts" hidden><pre>…</pre></div>
</div>
```

## Explainer affordances

**Source-ref chip.** A static `file:line-range` chip anchoring a claim to where
the coder implements it. It nests inside headings, steps, or findings:

```html
<span class="discovery-source-ref" data-presentation-pattern="source-ref-chip"
  >db/migrate/20260714_expand_orders.rb:1-14</span
>
```

**FAQ block.** Anticipated reviewer questions as a `<dl>`, each answer optionally
carrying a provenance pill and a source-ref chip:

```html
<dl class="discovery-faq" data-presentation-pattern="faq-block">
  <dt>Can three application versions overlap during a rolling deploy?</dt>
  <dd>
    Yes — the expand step keeps every build reading both shapes.
    <span class="discovery-provenance" data-provenance="observed"
      >observed</span
    >
  </dd>
</dl>
```

**Live simulation.** A parameter-driven inline readout: controls drive a seeded,
deterministic SVG or DOM output in `[data-sim-stage]`. Controls that capture a
preference are ordinary decision or follow-up questions; purely pedagogic
controls carry `data-sim-control` and stay out of the prompt. Behaviour lives in
the page's inline script (the domain-explainer simulator convention), not the
shared runtime:

```html
<div data-presentation-pattern="live-sim">
  <label data-sim-control
    >Cohort <input type="range" data-sim-cohort min="0" max="100"
  /></label>
  <div data-sim-stage aria-live="polite"><!-- generated readout --></div>
</div>
```

**Exclusive accordion.** A `[data-accordion-exclusive]` group of `<details>`
where opening one closes its siblings; leave the key item `open` by default.
Nested groups stay independent. Wired by `installExclusiveAccordions`:

```html
<div data-accordion-exclusive data-presentation-pattern="accordion-exclusive">
  <details open>
    <summary>Read-path failure</summary>
    …
  </details>
  <details>
    <summary>Write-path failure</summary>
    …
  </details>
</div>
```

**Anchor flash.** Sidebar / TOC navigation briefly flashes the destination
section. The runtime (`installAnchorFlash`) adds a transient
`.discovery-anchor-flash` on nav click and `hashchange`, and skips the animation
entirely under reduced motion. Mark the navigation that triggers the flash:

```html
<nav class="essential-docnav" data-presentation-pattern="anchor-flash">
  <a href="#failure-boundaries">Failure boundaries</a>
</nav>
```

## Architecture & provenance

**Node/edge diagram.** A hand-authored inline SVG with a visible legend. Nodes
and edges carry semantic classes (`discovery-node-*`, `discovery-edge-*`) mapped
to `--ui-*` tokens, and each node has a `<title>` for assistive tech:

```html
<svg viewBox="0 0 480 240" data-presentation-pattern="node-edge-diagram">
  <g class="discovery-node-source">
    <title>WebSocket ingress</title>
    …
  </g>
  <path class="discovery-edge-flow" d="M120 60 H260" />
</svg>
```

**Diagram detail.** Clickable diagram nodes populate a sticky detail host from
hidden templates (cloned, never `innerHTML`). The host is an aria-live region;
the selected node gets `.is-active`. Wired by `installDiagramDetail`:

```html
<g
  data-diagram-node="merge"
  tabindex="0"
  data-presentation-pattern="diagram-detail"
  >…</g
>
<aside data-diagram-detail-host aria-live="polite"></aside>
<template data-diagram-detail="merge">
  <h3>CRDT merge</h3>
  <p>Resolves concurrent edits before fan-out.</p>
</template>
```

**Prompt echo.** A static card near the page top quoting the verbatim request
that produced the board, with a labelled divider separating it from what the
coder built:

```html
<section class="discovery-prompt-echo" data-presentation-pattern="prompt-echo">
  <p class="discovery-eyebrow">The request that produced this board</p>
  <blockquote>“Lay out the architecture before anyone writes code…”</blockquote>
  <p class="discovery-prompt-echo-divider">What the coder produced from it</p>
  <p>A four-node data-flow decomposition with per-node ownership.</p>
</section>
```

**Source manifest.** A "generated from" list of the files and data the coder
actually read — one per page — each row leading with a source-ref-style path and
an optional provenance pill:

```html
<ul
  class="discovery-source-manifest"
  data-presentation-pattern="source-manifest"
>
  <li>
    <span class="discovery-source-ref">gateway/ws_server.ts:1-120</span>
    <span class="discovery-provenance" data-provenance="observed"
      >observed</span
    >
  </li>
</ul>
```

## Risk & readiness

**Risk matrix.** A severity / likelihood / mitigation table whose severity cells
carry `[data-severity="low|medium|high|critical"]` pills on the amber→terracotta
token scale (no new hex). A muted caption states the ratings are review
assessments, not measured rates:

```html
<table class="discovery-table" data-presentation-pattern="risk-matrix">
  <tr>
    <td>AUTH-07 refresh race</td>
    <td><span data-severity="critical">critical</span></td>
    <td>Likely</td>
    <td>Serialize refresh · owner: auth</td>
  </tr>
</table>
```

**Owner routing.** An owner + due-date affordance on a finding or action item:
an avatar-initial, a name, and an optional date.

```html
<span class="discovery-owner-chip" data-presentation-pattern="owner-routing">
  <span aria-hidden="true">RS</span> Rina S. · due Jul 28
</span>
```

**TL;DR block.** A visually distinct executive-summary lead of two to four
strong-lead bullets, placed before the first section's prose:

```html
<div class="discovery-tldr" data-presentation-pattern="tldr-block">
  <h2>Executive summary</h2>
  <ul>
    <li>
      <strong>Not a model-quality launch.</strong> The blocker is one auth race.
    </li>
    <li>
      <strong>Two probes still open.</strong> Both must clear before cutover.
    </li>
  </ul>
</div>
```

**Milestone timeline.** Two variants of `.discovery-milestone-timeline`. A dated
roadmap uses a `.discovery-milestone-date` gutter, state dots
(`[data-milestone-state="done|active|pending"]`), and per-slice
`.discovery-milestone-tags` chips; an event chronology uses mono
`.discovery-milestone-time` timestamps instead. Fabricated dates/times carry the
invented-data flag:

```html
<ol
  class="discovery-milestone-timeline"
  data-presentation-pattern="milestone-timeline"
>
  <li data-milestone-state="done">
    <span class="discovery-milestone-date">Wk0</span> Discovery
    <span class="discovery-milestone-tags"><span>done</span></span>
  </li>
  <li data-milestone-state="active">
    <span class="discovery-milestone-date">Wk1</span> Ownership trace
  </li>
</ol>
```

**Inline chart.** Hand-authored inline SVG/DOM chart blocks — `.discovery-chart`
bars, a `.discovery-sparkline`, or a `.discovery-kpi-delta`. Fabricated values
carry `data-fabricated` plus the invented tag, and each chart has accessible
fallback text:

```html
<div
  class="discovery-chart"
  data-presentation-pattern="inline-chart"
  data-fabricated
>
  <div class="discovery-chart-bar">
    <span class="discovery-chart-track"
      ><span class="discovery-chart-fill" style="--value:62%"></span
    ></span>
  </div>
  <span class="discovery-invented-tag" data-invented-tag>invented</span>
</div>
```

**Filter chips.** Upgrade the activity filter bar so chips carry live counts and
selecting one DIMS non-matching items (`.is-dimmed`, opacity + grayscale) rather
than hiding them, keeping counts truthful. The runtime (`installFilterChips`)
computes counts from the data and applies the dimming. A chip value of `all`
matches everything:

```html
<div data-filter-chips data-presentation-pattern="filter-chips">
  <button data-filter="all">All <span data-filter-count></span></button>
  <button data-filter="blocking">
    Blocking <span data-filter-count></span>
  </button>
</div>
<ul>
  <li data-filter-item="blocking g4">Ownership trace</li>
  <li data-filter-item="done">Call graph traced</li>
</ul>
```

## Options & brainstorm

**Verdict table.** A comparison table with per-cell judgment colouring via
`[data-verdict="good|mixed|bad"]` (insight / amber / accent tints, tokens only).
Pair it with an inline glyph+colour legend so the key is legible before the
table:

```html
<table data-presentation-pattern="verdict-table">
  <tr>
    <td>Producer adapter</td>
    <td data-verdict="good">✓ Owns its write path</td>
    <td data-verdict="bad">✕ No rollback lever</td>
  </tr>
</table>
```

**Variant rationale.** A one-line "best for…" thesis caption under each
option/variant artifact, tying the variant to the ranking logic:

```html
<p
  class="discovery-variant-rationale"
  data-presentation-pattern="variant-rationale"
>
  <strong>Best for rollback-first teams.</strong> The adapter keeps one
  reversible seam.
</p>
```

**Scope cuts.** The author's own self-disclosure: non-goals, deliberate
omissions, and weakest-part flags. Distinct from trade-offs-honestly (which is
about the _direction's_ costs) — this is about the _author's_ cuts:

```html
<aside class="discovery-scope-cuts" data-presentation-pattern="scope-cuts">
  <h3>What I cut, deliberately</h3>
  <ul>
    <li>No multi-region story — single-region only for this pass.</li>
    <li>Weakest part: the consumer-translator rank rests on one interview.</li>
  </ul>
</aside>
```

**Spectrum minimap.** A sticky strip of numbered dot `<button>`s along the
cheap→ambitious axis, one per idea card. Clicking a dot smooth-scrolls to its
card; each dot mirrors the card's reaction state (two-way sync). The runtime
(`installSpectrumMinimap`) requires the dot ids to be the same set as the
`[data-idea-id]` cards (dots == idea cards):

```html
<nav class="discovery-minimap" data-presentation-pattern="spectrum-minimap">
  <span>Cheap · hours</span>
  <div class="discovery-minimap-axis">
    <button data-minimap-dot="1">1</button>
    <button data-minimap-dot="2">2</button>
  </div>
  <span>Ambitious · quarter</span>
</nav>
<article data-idea-card data-idea-id="1">…</article>
```

**Reaction chips.** Lightweight steal/skip reactions on individual idea traits,
implemented as checkbox `data-discovery-question` follow-up fieldsets so they
flow into the prompt as reactions, not decisions:

```html
<fieldset
  data-discovery-question
  data-response-kind="follow-up"
  data-question-id="idea-1-reaction"
  data-question-label="Idea 1 reaction"
  data-presentation-pattern="reaction-chips"
>
  <legend>What survives from this idea?</legend>
  <label
    ><input
      type="checkbox"
      value="Steal the debounce"
      data-reaction-kind="steal"
    />Steal</label
  >
  <label
    ><input
      type="checkbox"
      value="Skip the rest"
      data-reaction-kind="skip"
    />Skip</label
  >
</fieldset>
```

## Guided interview

**Wizard steps.** A focused one-question-at-a-time presentation over the existing
stepper. The `[data-wizard]` container wraps the `[data-interview-step]`
sections; a glass control panel holds `[data-wizard-prev]`, `[data-wizard-next]`,
a `[data-wizard-toggle]` ("show every question"), a `.discovery-wizard-progress`
hint, and an empty `[data-wizard-summary]` jump-back list. Answers stay ordinary
decision questions. No-JS fallback: every step stays visible. Wired by
`installWizard`:

```html
<div data-wizard data-presentation-pattern="wizard-steps">
  <div class="discovery-wizard-controls">
    <button data-wizard-prev>Back</button>
    <span class="discovery-wizard-progress"></span>
    <button data-wizard-next>Next</button>
    <button data-wizard-toggle>Show every question</button>
  </div>
  <ol class="discovery-wizard-summary" data-wizard-summary></ol>
  <section data-interview-step="1">…</section>
  <section data-interview-step="2">…</section>
</div>
```

**Natural-language reply.** A conversational one-paragraph preview of the reply,
assembled from touched answers, note counts, and changed probes, rendered above
the raw Markdown host. The runtime (`installNlReply`) fills it with `textContent`
only and regenerates it with the prompt; the copy control still copies the one
canonical Markdown prompt:

```html
<div
  class="discovery-nl-reply"
  data-nl-reply
  data-presentation-pattern="nl-reply"
></div>
<textarea data-discovery-prompt-host readonly></textarea>
```

## Prototype & motion

**Drag probe.** A native HTML5 drag-and-drop feel probe. Items reorder within
`[data-drag-probe]`; the runtime (`installDragProbes`) records the initial order,
persists the current one, and — once the order differs from the authored default
— surfaces it in the generated prompt under a `## Interaction results` section as
`- **<label>:** a → b → c`. Keyboard reorder (arrow keys on a focused item) keeps
it operable without a pointer. Keep at least three items:

```html
<ol
  data-drag-probe="reading-order"
  data-drag-label="Reading order"
  data-presentation-pattern="drag-probe"
>
  <li class="discovery-drag-item" data-drag-item="intent">Intent</li>
  <li class="discovery-drag-item" data-drag-item="diff">Diff</li>
  <li class="discovery-drag-item" data-drag-item="evidence">Evidence</li>
</ol>
```

The serialization is the only new prompt contract in this batch: an untouched
probe contributes nothing, so a default order is never mistaken for a decision.

**Motion specimen.** A micro-interaction sandbox with a replay button, a keyframe
timing rail driven by `--rail-progress`, live 0/mid/end time marks, and an
easing-swap decision question. CSS transitions only; disabled under reduced
motion:

```html
<div
  class="discovery-motion-specimen"
  data-motion-specimen
  data-presentation-pattern="motion-specimen"
>
  <div class="discovery-motion-stage" data-motion-target>…</div>
  <div class="discovery-motion-timing-rail" data-motion-rail></div>
  <div class="discovery-motion-marks">
    <span data-motion-mid></span><span data-motion-end></span>
  </div>
  <button data-motion-replay>Replay</button>
</div>
```

**Demo loop.** An auto-playing scripted demo of a flow with a progress bar and a
success toast, plus pause/replay controls, marked decorative for reduced motion.
Behaviour lives in the page's inline script:

```html
<div
  class="discovery-demo-loop"
  data-demo-loop
  data-presentation-pattern="demo-loop"
>
  <div data-demo-step="1">…</div>
  <div class="discovery-demo-progress" data-demo-progress></div>
  <div class="discovery-demo-toast" data-demo-toast hidden>Sent</div>
  <button data-demo-toggle>Pause</button>
  <button data-demo-restart>Replay</button>
</div>
```

## Design-review rigs

**Global rig.** One toolbar of controls that re-themes or re-tunes _every_
specimen on the board at once. The controls are ordinary decision/follow-up
questions; a deterministic page-inline script maps their values onto every
governed `[data-specimen][data-rig]` container (e.g. a surface toggle stamps
`data-theme="dark"`, a density toggle stamps `data-density="compact"`), so the
values still flow into the single generated prompt:

```html
<div
  class="discovery-global-rig"
  data-global-rig
  data-presentation-pattern="global-rig"
>
  <fieldset
    data-discovery-question
    data-question-id="rig-surface"
    data-question-label="Surface"
  >
    <legend>Surface</legend>
    <label
      ><input
        type="radio"
        name="rig-surface"
        value="Light"
        checked
      />Light</label
    >
    <label><input type="radio" name="rig-surface" value="Dark" />Dark</label>
  </fieldset>
</div>
<div data-specimen data-rig>…the governed mockup…</div>
```

**Artboard & mock frames.** Two chromeless variants of the browser-frame. The
artboard is a fixed-height centered stage with a corner mono tag and a rationale
caption; the mock frame is a labelled generic device/app chrome carrying a
visible fidelity label so no one mistakes it for a live pane:

```html
<figure class="discovery-artboard" data-presentation-pattern="artboard-frame">
  <span class="discovery-artboard-tag">order-row</span>
  <div class="discovery-artboard-stage">…</div>
  <figcaption class="discovery-artboard-caption">
    Resting state, one row.
  </figcaption>
</figure>

<div class="discovery-mock-frame" data-presentation-pattern="mock-frame">
  <div class="discovery-mock-frame-bar">
    <span class="discovery-mock-frame-label"
      >mock — nothing behind this pane</span
    >
  </div>
  <div class="discovery-mock-frame-body">…</div>
</div>
```

**Theme-direction gallery.** Competing complete theme directions side by side.
Each direction is its own `[data-specimen]` with its own scoped re-point over a
shared neutral scaffold, comparable content in each card. This is the one place
the single-specimen exception extends to multiple simultaneous specimen scopes on
one board — several `[data-specimen]` containers coexisting is deliberate here,
not a regression of the "one specimen re-point" convention:

```html
<div
  class="discovery-theme-gallery"
  data-presentation-pattern="theme-direction-gallery"
>
  <div data-specimen style="--specimen-accent:#4f46e5">…Indigo direction…</div>
  <div data-specimen style="--specimen-accent:#0d9488">…Teal direction…</div>
  <div data-specimen style="--specimen-accent:#b45309">…Amber direction…</div>
</div>
```

## Plan review

**Tweak rank.** A visible "most likely to change → settled" affordance on each
plan step, so the steps read in the order the user is most likely to want to
touch. The three-pip `.discovery-tweak-scale` doubles the rank as fill count, so
the ordering never rests on colour alone. Every `[data-plan-step]` section
carries one:

```html
<section
  data-discovery-section
  data-section-id="step-merge-model"
  data-plan-step
>
  <span
    class="discovery-tweak-rank"
    data-tweak-rank="most-likely"
    data-presentation-pattern="tweak-rank"
  >
    <span class="discovery-tweak-scale" aria-hidden="true"
      ><i></i><i></i><i></i
    ></span>
    Most likely to change
  </span>
  <!-- step content + one decision question + honest trade-offs -->
</section>
```

**Linked diagram choice.** One schema-affecting step whose choice cards rewrite
flagged rows of a shared inline schema diagram in lockstep. The decision fieldset
and the diagram share a key; a deterministic page-inline script toggles the
`[data-diagram-variant]` rows and updates an aria-live status line (`textContent`
only, never `innerHTML`). It stays readable with the recommended variant shown
before scripts run:

```html
<div
  data-linked-diagram-choice="merge-model"
  data-presentation-pattern="linked-diagram-choice"
>
  <div data-linked-diagram="merge-model" aria-live="polite">
    <div data-diagram-variant="a">merged_into_id uuid · null</div>
    <div data-diagram-variant="b" hidden>… ledger table …</div>
  </div>
  <p>
    <span data-diagram-status
      >Showing: <strong>redirect tombstone</strong>.</span
    >
  </p>
  <fieldset
    data-discovery-question
    data-question-id="merge-representation"
    data-linked-choice="merge-model"
  >
    <legend>How should a completed merge be stored?</legend>
    <label
      ><input
        type="radio"
        name="merge-representation"
        data-variant="a"
        checked
      />Redirect tombstone</label
    >
    <label
      ><input type="radio" name="merge-representation" data-variant="b" />Merge
      ledger table</label
    >
  </fieldset>
</div>
```

Each `[data-plan-step]` contains exactly one decision question — accept the
recommendation, take the named alternative, or tweak it in text — and the page
closes with exactly one `[data-plan-verdict]` fieldset (hand off as-is / hand off
with the marked tweaks / needs another pass).

## Build journal

**Journal badges.** A type-keyed badge taxonomy on a reused `milestone-timeline`
event chronology, so plan-confirmed steps, discoveries, deviations, and human
hand-offs read at a glance. The `data-journal-kind` value keys the colour to
tokens; the visible label is author-provided:

```html
<span class="discovery-journal-badge" data-journal-kind="deviation"
  >Deviation 1 of 4</span
>
<!-- kinds: plan-confirmed · discovery · deviation · todo-for-human -->
```

**Deviation anatomy.** Each `[data-deviation]` entry states the same four
labelled parts so the reader can triage it in place, and the fourth part carries
a per-deviation revisit question (accept the choice / revisit before merge):

```html
<article data-deviation data-presentation-pattern="deviation-log">
  <div class="discovery-deviation-anatomy">
    <div class="discovery-deviation-field" data-deviation-field="plan-said">
      …
    </div>
    <div class="discovery-deviation-field" data-deviation-field="code-revealed">
      …
    </div>
    <div class="discovery-deviation-field" data-deviation-field="choice-taken">
      …
    </div>
    <div class="discovery-deviation-field" data-deviation-field="revisit">
      <fieldset
        data-discovery-question
        data-question-id="revisit-shapes"
        data-question-label="Deviation 1"
      >
        <legend>How should this settle?</legend>
        <label
          ><input
            type="radio"
            name="revisit-shapes"
            data-recommended="true"
            checked
          />Accept the choice</label
        >
        <label
          ><input type="radio" name="revisit-shapes" />Revisit before
          merge</label
        >
      </fieldset>
    </div>
  </div>
</article>
```

All four `data-deviation-field` labels (`plan-said`, `code-revealed`,
`choice-taken`, `revisit`) are required on every entry, and every entry anchors
to `file:line` with a reused `source-ref-chip`.

**Human todo.** An agent-authored decision the build declined to guess, routed to
a person with `owner-routing` rather than resolved silently:

```html
<div data-human-todo data-presentation-pattern="human-todo">
  <div class="discovery-human-todo-body">
    <h3>Pick the geofence-edge alert cap threshold</h3>
    <p>
      … why it is a product call …
      <span class="discovery-source-ref">config/alerts.yaml:12-19</span>
    </p>
    <span class="discovery-owner-chip" data-owner-initial="PN"
      >Priya N. · Fleet Product · due Jul 24</span
    >
  </div>
</div>
```

The board closes with exactly one `[data-journal-verdict]` question (proceed to
review / pause for the flagged revisits).

## Change walkthrough

**VCS header.** A repo / branch→target / diff-stat / author strip at the top of a
change report. Line and commit counts are illustrative, so the stat block carries
`data-fabricated` + the invented tag:

```html
<div
  class="discovery-vcs-header"
  data-presentation-pattern="change-walkthrough vcs-header"
>
  <span class="discovery-vcs-repo">sonar/alerting-core</span>
  <span class="discovery-vcs-branch"
    ><span>feat/alert-dedup</span
    ><span class="discovery-vcs-arrow" aria-hidden="true"></span
    ><span>main</span></span
  >
  <span class="discovery-vcs-stats" data-fabricated>
    <span class="discovery-vcs-add">324</span
    ><span class="discovery-vcs-del">96</span>
    <span class="discovery-invented-tag" data-invented-tag>invented</span>
  </span>
  <span class="discovery-owner-chip" data-owner-initial="CA"
    >Coding agent · 7 commits</span
  >
</div>
```

**File tour.** A risk-ordered reading path: a jump map of `.discovery-risk-chip`
(`[data-risk="high|medium|low"]`) links over per-file `[data-file-card]`s, each a
reused `rich-diff` excerpt. Every file card carries at least one risk chip, and
cards are ordered highest-risk first:

```html
<div
  class="discovery-file-tour"
  data-presentation-pattern="file-tour change-walkthrough"
>
  <nav class="discovery-file-tour-map" aria-label="Jump to a file">
    <a href="#card-dedupe"
      >dedupe.go
      <span class="discovery-risk-chip" data-risk="high">high</span></a
    >
  </nav>
  <article id="card-dedupe" data-file-card>
    <div class="discovery-file-card-head">
      <span class="discovery-source-ref">services/alerts/dedupe.go</span>
      <span class="discovery-risk-chip" data-risk="high">high</span>
    </div>
    <div class="discovery-diff"><!-- rich-diff rows + a diff-comment --></div>
  </article>
</div>
```

**Diff comment.** A severity-labelled reviewer note anchored to a specific diff
row, sitting inside the file card's diff so the note reads beside the code it is
about. At least two anchor the behavior-deciding rows:

```html
<div data-diff-comment data-presentation-pattern="diff-comment">
  <div class="discovery-diff-comment-head">
    <span data-severity="high">high</span>
    <span class="discovery-source-ref">services/alerts/dedupe.go:34</span>
  </div>
  <p>
    With severity out of the key, an open incident can appear to downgrade …
  </p>
</div>
```

**Deck mode.** The change story as a keyboard-navigable, scroll-snap strip of
`[data-deck-slide]` panels. The runtime (`installDeckMode`) wires the Prev/Next
buttons, arrow-key/space navigation on a focused deck, and the
`[data-deck-progress]` readout; the strip stays a plain readable scrolled list
without JavaScript and under reduced motion:

```html
<div
  class="discovery-deck"
  data-deck
  data-presentation-pattern="deck-mode change-walkthrough"
>
  <div class="discovery-deck-controls">
    <button type="button" data-deck-prev>Prev</button>
    <span class="discovery-deck-progress" data-deck-progress aria-live="polite"
      >1 / 4</span
    >
    <button type="button" data-deck-next>Next</button>
  </div>
  <div class="discovery-deck-strip">
    <article
      class="discovery-deck-slide"
      data-deck-slide
      aria-label="Slide 1 of 4"
    >
      …
    </article>
    <article
      class="discovery-deck-slide"
      data-deck-slide
      aria-label="Slide 2 of 4"
    >
      …
    </article>
  </div>
</div>
```

The comprehension gate reuses `quiz-gate` (at least two `[data-quiz-question]`
follow-up questions with a `<details>` reveal each), and the board closes with
exactly one final `[data-change-verdict]` question (approve / approve with
follow-ups / request changes) plus a free-text follow-up.

## Triage board

**Kanban lanes.** A Now/Next/Later/Cut kanban strip whose lane membership and
within-lane order ARE the user's answer. Each lane is a `[data-kanban-lane]`
holding a `[data-kanban-cards]` list, and each card is a
`.discovery-drag-item.discovery-kanban-card` — the same `[data-drag-item]` the
stage-3 `drag-probe` runtime already reorders and serializes. A page-inline
script adds the two things the single-container probe runtime does not:
cross-lane pointer drops, and a **per-card lane `<select>` keyboard fallback**
(an ordinary `data-discovery-question`) that moves the card without a pointer.
Lane counts stay honest as cards arrive and leave, and on reload the card nodes
are reconciled to the hydrated select values:

```html
<div
  class="discovery-kanban"
  data-kanban-board
  data-presentation-pattern="kanban-lanes"
>
  <div class="discovery-kanban-lane" data-kanban-lane="now">
    <div class="discovery-kanban-lane-head">
      <span class="discovery-kanban-lane-title">Now</span>
      <span class="discovery-kanban-lane-count" data-kanban-count>3</span>
    </div>
    <div
      data-drag-probe="lane-now"
      data-probe-label="Now lane — order"
      data-kanban-cards
    >
      <article
        class="discovery-drag-item discovery-kanban-card"
        data-drag-item="BEA-412"
        data-drag-label="…"
      >
        <p class="discovery-kanban-card-title">…</p>
        <div
          class="discovery-kanban-move"
          data-discovery-question
          data-question-id="lane-BEA-412"
          data-question-label="Lane · BEA-412"
        >
          <span aria-hidden="true">Move to lane</span>
          <select aria-label="Move BEA-412 to a lane">
            <option value="Now" data-lane="now" selected>Now</option>
            <option value="Next" data-lane="next">Next</option>
            <option value="Later" data-lane="later">Later</option>
            <option value="Cut" data-lane="cut">Cut</option>
          </select>
        </div>
      </article>
    </div>
  </div>
  <!-- next / later / cut lanes -->
</div>
```

**Prompt serialization.** No new prompt contract is introduced. Within-lane
order rides the stage-3 `drag-probe` `## Interaction results` serialization (one
probe per lane); lane membership rides each card's lane `<select>` — an ordinary
touched decision — into the prompt's confirmed decisions. An untouched card
therefore travels back as a suggestion, and a moved card as a decision, so a
starting placement is never mistaken for the user's answer. Use at least three
lanes and at least six cards, each card with its lane `<select>`.

## Decision-first devices (from the free-form lessons)

Recipes distilled from the approved reference boards
(`examples/reference/readiness-verdict-board.html`,
`examples/reference/decision-browser.html`).
They compose existing floor mechanisms — most need only bespoke, token-styled
in-page CSS, which the free-form policy welcomes.

- **Editorial masthead position line.** Give the masthead eyebrow a glyph and
  a position: `<p class="discovery-eyebrow"><span aria-hidden="true">🚦</span>
  Question 3 of 3 — Readiness · Prospector</p>`. Orients the reader inside a
  board set at a glance; pair with the multi-board hub.

- **Stat rails.** Shell component: inside a `discovery-stat-strip` tile, add
  `<span class="discovery-stat-rail" style="background: var(--ui-verdict-stop)"></span>`
  — a 3px left rail colored by the semantic ramp the tile counts. Counts
  become scannable by hue before they are read.

- **Decision-first card.** One card per finding/verdict/decision, in this
  order: tag row (id, category via `--ui-k-*`, blocking, severity) → title →
  the question → Evidence (with provenance pill) → **the response control** →
  "Why it bites" → a plain-English translation line → owner chip +
  `file:line` source chips. The response control is a decision-question
  fieldset embedded in the card, so the shared runtime captures it into the
  counters and the generated prompt:
  - **Real alternatives exist → option set.** Render 2–4 `discovery-option`
    labels, each with its reason in `<small>`, the recommended one carrying
    `data-recommended` and a `discovery-badge`. Never a bare accept button in
    this case — the selection is the decision.
  - **Single recommendation → accept toggle.** A checkbox/radio pair
    ("Accept as-is" recommended / "I'll override — see my note") keeps
    capture uniform through the same runtime.
  Notes ride the section annotation mechanism; state must be visible on the
  card and, on card-stage boards, on its pip.

- **Verdict / status semantics.** Color card edges, pills, and rails through
  the semantic ramps (`--ui-verdict-*`, `--ui-status-*`, `--ui-k-*`), not
  ad-hoc classes — the board-theme overlay then re-tints the whole board
  consistently.

- **Readiness meter.** Shell component: a labeled `n/5` bar —
  `<div class="discovery-meter-row"><span class="discovery-meter-label">ready</span>
  <span class="discovery-meter"><i style="width: 60%; background: var(--ui-verdict-partial)"></i></span>
  <span class="discovery-meter-value">3/5</span></div>`. Track on
  `--ui-surface`, fill on the card's ramp color, value in `tabular-nums`.

- **Landing-map row.** One row per disposition bucket (land / landed / rework
  / park / orphan): a 4px left border and dot on the bucket's ramp color, a
  bold disposition label with a small qualifier, and the member list as prose
  with `code` ids.

- **Critical-path strip.** A horizontal flex of small step tiles joined by
  `→`, each tile an eyebrow-style label plus one sentence; color the terminal
  blocked tile with `--ui-verdict-stop`. Answers "why is this blocked" in one
  glance.

- **Filter chips + pip index (card-stage boards).** Chips carry
  `aria-pressed` and either hide or dim non-matching cards. The pip row shows
  one small numbered button per card: blocking pips borrow the danger color,
  answered/decided pips show ✓, filtered-out pips dim. Keyboard: `←`/`→` move
  between cards, `A` accepts / selects the recommended option; keep every
  control focusable with a visible focus state.

- **Data-driven card sets.** When many cards share one shape, author the
  content once as a JS array and render through a small builder that escapes
  every field (the `esc()` idiom) and assigns ramp colors from data. The
  builder rejects output containing un-interpolated `${…}` in rendered text —
  interpolate before emit. Prefer building DOM via `createElement`/
  `textContent` where practical; never inject unescaped strings.

## Extending the catalog

These four conventions and the page shell, annotatable sections, single-prompt
contract, and `--ui-*`/`@theme inline` theme are a fixed foundation. On top of
it an executor may add new structural cards, provided each honors the theme,
the interaction contract (annotatable plus one live prompt), provenance, and
accessibility. Guided, not rigid — never regress the foundation to add a card.

## Catalog coverage markers

The checked-in examples also serve as an exhaustive demonstration suite. Mark
the element that visibly implements a catalog pattern with
`data-presentation-pattern="pattern-id"`; use a space-separated value when one
composition legitimately demonstrates several patterns. The allowed IDs and
their action owners are listed in [coverage](coverage.md).

Markers are test evidence, not styling hooks. Never mark an absent component or
force every component into a generated user artifact. The checked-in boards show
every marker at once because their job is exhaustive demonstration; a generated
page reads them as a showcase of what is possible, not a checklist to fill. The
complete validator checks suite coverage while each executor remains free to
choose the smallest useful task-specific composition.

## Action-structure hooks

Examples also expose semantic `data-*` hooks for the structural validator.
These hooks name the job performed by an element—such as
`data-option-frame`, `data-idea-card`, `data-interview-step`, or
`data-readiness-gate`—and are never styling hooks. Their required counts live
in `scripts/test_html_templates.py` beside the executable check.

A structural hook is valid only on a substantive visible element. For example,
an option frame contains a credible artifact and its local reaction control; an
idea card contains a grounded intervention rather than a title placeholder; a
semantics mapping includes source evidence, target behavior, and a consequence.
Meeting a count with empty wrappers is a failed review even when the mechanical
validator passes.
