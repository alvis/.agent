# Design Boards — Visual Choice Capture

Mechanics for every visual choice board referenced by SKILL.md `<direction>` and `<area_boards>`. A board is bespoke design work — each tile IS a miniature of its candidate — so there is no rigid `.template.html`; the skeletons below guarantee structure, self-containment, and the choice UX while leaving the visuals to each candidate.

These board types share one mechanic:

| Board type | Chooses | Tiles | When |
|---|---|---|---|
| **Direction board** (Part B) | The page-wide aesthetic direction | 3–5 direction candidates | Once, during `<direction>` |
| **Area board** (Part C) | One area's composition/treatment within the locked direction | `N` ranked variants of ONE area (`N=3` by default) | Once per area, during `<area_boards>` |
| **Diff board** | Confirms the built implementation matches the design | Two panes — design-reference render beside the implementation capture — for one area and mode | Once per area × {light, dark} (+ full page), during Phase 6 |

The diff board is a confirmation artifact, not a choice board: no rank badges, no mix-and-match loop. It reuses Part A's render → screenshot → `SendUserFile` presentation (A4) and records its user sign-off per A5, but each tile pairs the agreed design with what was built rather than presenting competing candidates. SKILL.md governs its scope under `<design-evidence-dir>/diffs/`.

---

## Part A — Shared Board Mechanics

### A1. Purpose

The user picks with their eyes, not from prose. Every board is rendered in Chrome, screenshotted, and the **screenshot image is the primary artifact the user sees** — a realistic picture of designed HTML, not a description of it.

### A2. File Location & Constraints

- Path: `<design-evidence-dir>/boards/<board-slug>.html` (`direction.html`, `hero.html`, `footer.html`, `connective-tissue.html`, …). Store the matching rendered image beside it as `<board-slug>.webp`.
- ONE self-contained file per board: inline CSS only, no JS frameworks, no build step. Google Fonts `<link>` tags are allowed (boards are throwaway local files), but every tile declares system-stack fallbacks so it still reads without network.
- REAL project content only — never lorem ipsum, never placeholder-gray boxes where the project has actual imagery or copy.
- Honor `prefers-reduced-motion` on every board (blanket media-query kill switch).

### A3. Rank Badges

The visual-reviewer ranks every candidate/variant before the board is presented. Each tile carries:

- A visible **rank badge** in its top corner: `#1 · recommended`, `#2`, … `#N` — high-contrast, impossible to miss in a screenshot.
- A one-line **"why this rank"** under the tile title (e.g., "#2 — strongest hierarchy, but the split layout fights the direction's density").

Tiles appear on the board in rank order, best first.

### A4. Presentation Procedure

Present the rendered image — remote users cannot see the local Chrome window:

1. `list_pages` → `new_page file://<absolute path>` → `take_screenshot` (full-page). **Look at the screenshot**: broken layout, missing fonts, clipped tiles, or unreadable rank badges get fixed BEFORE the user sees anything.
2. Save or convert the screenshot to `<design-evidence-dir>/boards/<board-slug>.webp`, then `SendUserFile` with `files: [<screenshot image path>]`, `display: render`, and a caption naming each numbered candidate/variant. The screenshot IS the deliverable; optionally attach the board HTML as a secondary file for users who want live hover/motion.

### A5. Choice Capture — the graphical or structured user-input capability convention

One use of the graphical or structured user-input capability per board (never batch two boards into one call). The convention, everywhere:

- ≤4 options per question (tool limit); every option's description states what picking it means.
- The reviewer-ranked **#1 candidate is the stated safe default**, marked "(Recommended)" and listed first.
- The final option is always an escape hatch: **"Another variant or mix — name the number(s)"** — this is how users pick #4+ or combine pieces, since all candidates stay numbered in the image.
- **Mix-and-match loop**: build ONE merged tile from the named pieces, append it to the board (with its own rank assessment), re-present (A4), re-ask. Loop until an explicit pick.
- **Record immediately** after each pick in the active work design child's decision-log section: every presented candidate's concrete design details, the chosen candidate, every rejected candidate with a one-line reason, the confirmation or auto-pick rationale, and any adjustment answers. Do not defer recording to the end of the run.

### A6. Cleanup

Boards are task evidence under `<design-evidence-dir>/`. Keep them through sign-off and retire them only through the shared work-retention lifecycle.

---

## Part B — Direction Board

Chooses the page-wide aesthetic. Three to five candidate tiles, each showing a direction's palette, type, layout rhythm, and signature motion applied to the user's REAL content.

### B1. Per-Tile Required Contents

Every tile must contain ALL of:

- [ ] Rank badge + "why this rank" (A3)
- [ ] Direction name + one-line thesis
- [ ] Palette strip — 5–7 role-labeled swatches (primary, accent, surface, fg, border…), light row AND dark row
- [ ] Type specimen — display + body faces set in REAL project words
- [ ] Mini hero mock (~480px tall) built from real project content in this direction's layout rhythm
- [ ] CSS-only motion demo of the signature micro-interaction — `:hover`/`:active` transitions plus ONE `@keyframes` entrance
- [ ] Footer line naming the anchor exemplar (facelift mode) or reference products, plus the 2–3 concrete visual properties borrowed (from direction question 2)

Candidates must differ on at least two of: palette strategy, display typeface, layout rhythm, motion language. A board of three near-identical tiles is a failed board.

### B2. Skeleton

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Design Directions — {project}</title>
  <!-- Google Fonts <link> tags for candidate faces; every tile declares system fallbacks -->
  <style>
    /* board chrome — deliberately plain so it never competes with the tiles */
    :root { --board-bg: #fafafa; --board-fg: #18181b; --board-border: #e4e4e7; }
    * { box-sizing: border-box; margin: 0; }
    body { background: var(--board-bg); color: var(--board-fg); font: 16px/1.6 system-ui, sans-serif; }
    header {
      position: sticky; top: 0; z-index: 10;
      display: flex; justify-content: space-between; align-items: baseline; gap: 16px;
      padding: 12px 24px; border-bottom: 1px solid var(--board-border);
      background: color-mix(in srgb, var(--board-bg) 88%, transparent); backdrop-filter: blur(8px);
    }
    .rank {
      display: inline-grid; place-items: center; padding: 4px 12px; border-radius: 4px;
      background: var(--board-fg); color: var(--board-bg); font: 700 13px/1 system-ui, sans-serif;
    }
    .direction { padding: 48px 24px; border-bottom: 4px solid var(--board-border); }
    .direction h2 { font-size: 28px; }
    .direction .thesis { opacity: 0.7; margin-bottom: 24px; }
    .palette { display: flex; gap: 8px; margin-block: 16px; }
    .swatch {
      flex: 1; height: 56px; border-radius: 6px;
      display: grid; place-items: end start; padding: 6px; font: 11px/1 ui-monospace, monospace;
    }
    .exemplar { margin-top: 24px; font-size: 13px; opacity: 0.6; }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation: none !important; transition: none !important; }
    }
  </style>
</head>
<body>
  <header>
    <strong>Design directions — {project}</strong>
    <span>Review each direction, then answer the question in the chat.</span>
  </header>

  <!-- ONE <article> per candidate, in rank order. Each tile carries its OWN mini-theme via
       scoped custom properties — the same token discipline the final theme will follow. -->
  <article class="direction" id="direction-1" style="
    --d-bg: {canvas}; --d-fg: {text}; --d-primary: {primary}; --d-accent: {accent};
    --d-font-display: {display face}, Georgia, serif;
    --d-font-body: {body face}, system-ui, sans-serif;
    background: var(--d-bg); color: var(--d-fg); font-family: var(--d-font-body);">
    <span class="rank">#1 · recommended</span>
    <h2 style="font-family: var(--d-font-display)">1 · {direction name}</h2>
    <p class="thesis">{one-line thesis} — {why this rank}</p>

    <div class="palette"><!-- 5–7 role-labeled swatches, e.g.: -->
      <div class="swatch" style="background: var(--d-primary); color: var(--d-bg)">primary</div>
      <!-- … repeat the full row with the dark-mode values beneath -->
    </div>

    <section class="specimen"><!-- display + body faces in REAL project words --></section>

    <section class="hero-mock"><!-- ~480px mini hero from REAL content in this direction's
      layout rhythm; signature micro-interaction as CSS-only :hover/:active transition
      + ONE @keyframes entrance --></section>

    <p class="exemplar">Anchor: {exemplar / reference products} · Signature: {2–3 concrete visual properties}</p>
  </article>

  <!-- direction-2, direction-3 … identical structure, each with its own mini-theme -->
</body>
</html>
```

### B3. Choice Battery

Per A5. Q1 — "Which direction?": with 3 candidates, one option per candidate (label = tile name, description = one-line thesis + anchor; #1 marked Recommended) + the mix escape hatch; with 4–5 candidates, the top-3 ranked + the escape hatch (the 4-option cap — lower-ranked candidates stay numbered in the image and pickable via the escape hatch, and its description says so). Q2 (optional) — density/mood adjustment (e.g. "Keep the density as shown / Airier / Denser") when the direction questions left room for doubt.

---

## Part C — Area Boards

One board per area of the page (navigation, hero, each content section, social proof, pricing, CTA band, footer…), run sequentially AFTER the direction is locked. Resolve `N` from `--variants=<N>` (`N=3` by default; `N` must be ≥2). Each board shows **N variants of that single area**, all in the locked direction, stacked in one column so the full-page screenshot reads as a single top-to-bottom comparison image.

### C1. Per-Variant Required Contents

Every variant must contain ALL of:

- [ ] Rank badge + "why this rank" (A3), numbered `1..N`
- [ ] The area rendered at realistic content width (desktop, ~1280px frame) with REAL project content
- [ ] **Explicit top AND bottom separator treatment** — how this variant meets its neighbors (chosen from the [Section Separator Vocabulary](design-reference.md#section-separator-vocabulary)); label the treatment in small print at each boundary
- [ ] **Visible hover-state demos** — CSS-only `:hover`/`:active`/`:focus-visible` on every interactive element in the variant; where hover can't be conveyed statically, render the key element twice side by side (rest + hover state) with a small "hover" label so the SCREENSHOT still shows it
- [ ] **Entrance-transition demo** — ONE `@keyframes` reveal showing this variant's scroll-entrance language (stagger, distance, easing)
- [ ] A one-line spec strip in small print: composition scheme · density · imagery treatment · separator pair · motion notes

Variants must differ on at least two of: composition, density, imagery treatment, separator treatment, motion. Near-identical variants are a failed board regardless of `N`. Every variant demonstrates the World-Class Element Checklist items (SKILL.md `<world_class_elements>`) relevant to its area.

### C2. Board Layout

- Sticky header naming the area and the locked direction (so screenshots stay self-explanatory).
- One full-width `<section>` per variant, rank order, separated by heavy board-chrome dividers that cannot be confused with the variants' own separator treatments.
- Board chrome stays deliberately plain (reuse the Part B skeleton's header/rank/reduced-motion CSS); each variant carries the locked direction's mini-theme via scoped custom properties.

### C3. Choice Battery

Per A5, use the graphical or structured user-input capability once per area board:

- **Q — "{Area}: which design?"** Options: up to the top three ranked variants that exist (`#1 {name} (Recommended)`, `#2 {name}`, and `#3 {name}` when present) plus **"Another variant or mix — name the number(s)"**. Each description = the variant's one-line spec strip + why-this-rank. If `N>3`, variants `#4..#N` remain fully pickable through the fourth option or free-text Other; if `N=2`, omit the nonexistent `#3` option.

Then move to the next area. One image → one question → next area. Never present two areas' boards before capturing the first pick (later areas are generated knowing the earlier picks, so choices compound coherently).

### C4. Connective-Tissue Board (final area board)

After all content areas are picked, run ONE more board for the cross-cutting choices the per-area picks did not fully settle:

- **Section-separator vocabulary** — the page-wide separator system: which treatments from the [Section Separator Vocabulary](design-reference.md#section-separator-vocabulary) appear where, demonstrated as rendered boundary samples between the actual chosen sections
- **Page-transition style** — route/page-level transition options (crossfade, shared-element morph, directional slide, wipe…), each demonstrated as a two-frame before/after strip with duration/easing labels
- **Scroll-reveal language** — the page-wide entrance system (distance, stagger, blur, once-only), demonstrated per option on a real chosen section

`N` combinations, ranked, using the same battery as C3. The winning combination becomes the active design child's “Motion, Transitions & Separators” specification.

### C5. `--quick` Mode

When the run has `--quick`, `N`-variant area boards are still generated and ranked but not presented one-by-one: the reviewer-ranked #1 variant of every board is auto-picked, each pick and its rank rationale are recorded in the active work design child, and the full set is summarized at the sign-off gate so the user can overturn any pick.
