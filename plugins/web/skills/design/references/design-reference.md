# Design Reference

Guardrails and quality baselines for visual design work. Consult this document during design decisions to avoid common pitfalls and maintain production quality. See `design.template.md` for the full design system template.

## Tech Stack Conflicts

These combinations produce silent failures or incoherent output. Never combine them.

| Never combine | Why |
|---|---|
| Tailwind + CSS Modules on the same element | Specificity conflicts, unpredictable cascade |
| Framer Motion + CSS transitions on the same element | Double-animating the same property causes jank |
| styled-components or emotion + Tailwind | Two competing class systems fighting for the same DOM node |
| Heroicons + Lucide + Font Awesome in one project | Visual inconsistency, size mismatches, bundle bloat |
| Multiple Google Font families as display fonts | Competing personalities cancel each other out |
| Glassmorphism backdrop-filter + solid `border: 1px solid` | Solid borders shatter the layered depth illusion |
| Dark background + `#ffffff` text at full opacity | Too harsh; use `rgba(255,255,255,0.85)` or `#f0f0f0` |
| Tailwind v4 `@theme` + dynamically constructed class names | JIT-generated utilities are purged when class names are built from variables. Fix: use static class names, add to `safelist`, or define colors in `:root` + `extend.colors` instead of `@theme` |

Before writing the first component, name the single CSS strategy for the project: Tailwind only, CSS Modules only, or CSS-in-JS only. Do not drift from it.

## Common Traps

AI models default to these patterns. Check whether any slipped in without explicit intention:

- A purple or blue gradient over white as the hero background
- A three-part hero: large headline, one-line subtext, two CTA buttons side by side
- A grid of cards with identical rounded corners, identical drop shadows, identical padding
- A top navigation bar with logo left, links center, primary action far right
- Sections that alternate between white and `#f9f9f9`
- A centered icon or illustration sitting above a heading above a paragraph
- A four-column footer with equal-weight columns

Any of these can appear if they serve the design intentionally. They cannot appear by default.

Final test: if you swapped in completely different content and the layout still made sense without changes, you built a template, not a design. Redo it.

## Production Quality Baseline

Non-negotiable requirements before handoff. Only apply craft details when they serve the locked visual direction. If removing a detail changes nothing about how the interface feels, leave it out.

### Accessibility

- Icon-only buttons need `aria-label`
- Actions use `<button>`, navigation uses `<a>` (not `<div onClick>`)
- Images need `alt` (or `alt=""` if decorative)
- Visible focus states: `focus-visible:ring-*` or equivalent; never `outline: none` without replacement

### Typography Details

- Text wrapping: `text-wrap: balance` on headings and short text blocks; `text-wrap: pretty` on body paragraphs and longer text; leave default on code blocks and pre-formatted text
- Font smoothing: apply `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale` once on the root layout (macOS only)
- Tabular numbers: use `font-variant-numeric: tabular-nums` for counters, timers, prices, number columns, or any dynamically updating numbers
- Letter-spacing scales with font size: roughly `-0.022em` for display sizes (32px+), `-0.012em` for mid-range (20-28px), normal at 16px and below. Positive letter-spacing on large headlines is always wrong

### Surfaces

- Concentric border radius: `outerRadius = innerRadius + padding` so nested rounded corners feel intentional; if padding exceeds 24px, treat layers as separate surfaces and choose each radius independently
- Optical alignment: nudge icons by eye so buttons feel centered; buttons with text and an icon use slightly less padding on the icon side (e.g., `pl-4 pr-3.5`); play triangles and asymmetric icons shift 1-2px toward the heavier side
- Shadows over borders: use layered `box-shadow` for depth on cards, buttons, and elevated elements; reserve `border` for dividers, table cells, and layout separation (applies primarily to light mode; dark mode uses background-color stepping instead)
- Image outlines: add a subtle inset outline so images hold their own depth: `outline: 1px solid rgba(0,0,0,0.1); outline-offset: -1px` (light) or `outline: 1px solid rgba(255,255,255,0.1); outline-offset: -1px` (dark)
- Minimum hit area: every interactive target at least 44x44px under this project's stricter rule (not a WCAG AA requirement); extend with a centered pseudo-element when the visible element is smaller; never let hit areas of two interactive elements overlap
- Light-mode surface hierarchy: adjacent nested surfaces must be visually distinguishable. Minimum: background-color step of at least 4% lightness between sidebar and main area, and between main area and cards; or a shadow of at least `0 1px 3px rgba(0,0,0,0.10)` on elevated cards. A white card on a near-white background with `box-shadow: 0 1px 2px rgba(0,0,0,0.05)` is invisible -- that is not depth
- Dark-mode surface hierarchy: page canvas is near-black solid (e.g., `#08090a`). Elevation uses semi-transparent white overlays: cards at `rgba(255,255,255,0.02)`, elevated surfaces at `0.04`, prominent panels at `0.05`. Borders follow the same logic: `rgba(255,255,255,0.05)` for subtle, `0.08` for standard. Traditional drop shadows are nearly invisible on dark surfaces; luminance stepping through background opacity is the primary depth cue
- Border radius system: define role-named radius tokens during direction lock (`--radius-control`, `--radius-card`, `--radius-modal`; fully-round elements use the `9999px` literal). Commit to the set before the first component so all surfaces share the same spatial language — never size-tier names like `--radius-md` (WT-VARIANT-01)

### Animation

- Honor `prefers-reduced-motion`: disable or reduce animations when set
- Animate `transform`/`opacity` only (compositor-friendly, no layout thrash)
- Never `transition: all`; list properties explicitly
- Interruptible animations: prefer CSS transitions for interactive state changes (hover, toggle, open/close); reserve keyframe animations for staged sequences that run once (e.g., staggered page enters)
- Staggered enter: split content into semantic chunks with ~100ms delay; titles into words at ~80ms; typical enter uses `opacity: 0 -> 1`, `translateY(12px) -> 0`, and `blur(4px) -> 0`
- Subtle exit: small fixed `translateY(-12px)` instead of full height; keep duration ~150ms `ease-in`, shorter and softer than enter
- Scale on press: buttons use `scale(0.96)` on active/press via CSS transitions; add a `static` prop to disable when motion would be distracting
- Page-load guard: use `initial={false}` on animated presence wrappers for toggles, tabs, and icon swaps to prevent enter animations on first render; do not use it for intentional page-load entrance sequences

### Performance

- Never `transition: all`; list exact properties (e.g., `transition-property: scale, opacity`). Tailwind's `transition-transform` covers `transform, translate, scale, rotate`; use `transition-[scale,opacity,filter]` for mixed properties
- Only use `will-change` for `transform`, `opacity`, or `filter`. Never `will-change: all`. Add only when you notice first-frame stutter; do not apply preemptively
- Images: explicit `width` and `height` (prevents layout shift)
- Below-fold images: `loading="lazy"`
- Critical fonts: `font-display: swap`

### Touch and Mobile

- `touch-action: manipulation` (prevents double-tap zoom delay)
- Full-bleed layouts: `env(safe-area-inset-*)` for notch devices
- Modals and drawers: `overscroll-behavior: contain`
- Hover guard: wrap interactive hover states with `@media(hover:hover)` so they only apply on pointer devices, not touch screens. Tailwind: `[@media(hover:hover)]:hover:bg-...`. Without this, a tapped element on mobile gets a permanent hover state until the next tap elsewhere

## Reflex Fonts to Reject

These are the fonts that appear in every AI-generated mockup because they dominate training data, signalling "no decision was made." The ban is on reflex use as a display face; informed product-UI use (e.g., Inter for a dense data table) is allowed when justified. More opinionated typefaces (Space Grotesk, DM Sans, IBM Plex, Playfair Display, etc.) are legitimate design choices and are not banned.

Reject for display use: Inter, Roboto, system-ui, Open Sans, Lato, Montserrat, Poppins, Nunito, Raleway.

## Font Selection Procedure

1. Write three words that describe the brand (e.g., "precise, minimal, fast")
2. Name the three fonts you would reach for reflexively
3. Reject all three
4. Pick a typeface from a named foundry (Klim, Commercial Type, Colophon, Grilli Type, OH no Type, Village, etc.) or an open-source option with a clear personality that matches the brand words. Be able to explain why that specific typeface in one sentence

## Color System: OKLCH Rules

- Use OKLCH instead of HSL. OKLCH is perceptually uniform: equal numeric changes produce equal perceived changes across the spectrum
- Reduce chroma as lightness approaches the extremes. At 85% lightness a chroma around 0.08 is enough; pushing to 0.15 looks garish. At 15% lightness, tighten chroma similarly
- Tint neutrals toward the brand hue with a chroma of 0.005 to 0.01. Even this faint amount is perceptible and creates subconscious cohesion
- 60-30-10 is about visual weight, not pixel count. 60% neutral/surface, 30% secondary text and borders, 10% accent
- Never use gray text on a colored background. Use a shade of the background hue at reduced lightness instead

## Theme Matrix

Choose light or dark deliberately based on audience and context. Neither is a default.

| Context | Direction | Reason |
|---|---|---|
| Trading or analytics dashboard, night-shift use | Dark | High data density; reduced glare during long sessions |
| Children's reading or learning app | Light | Welcoming, low fatigue for eyes still developing contrast sensitivity |
| Enterprise SRE or observability tool | Dark | Operator context; dark surfaces read at a glance in low-light rooms |
| Weekend planning, recipes, journaling | Light | Ambient daytime use; light feels casual and approachable |
| Music player or media browser | Dark | Content-forward; dark surfaces recede and let media pop |
| Hospital or clinical patient portal | Light | Trust and legibility are paramount; clinical associations favor light |
| Vintage or artisanal brand site | Cream/warm light | Dark would clash with analog material references |

A light-only visual direction is a deliberate design choice, not a default and
not a runtime mode contract. Record the chosen direction from audience and
context evidence. When the product supports both light and dark runtime modes,
route implementation through `web:css`: define raw light/dark tokens inside
`@layer theme`, resolve active semantic/UI tokens across all five branches
(baseline, system light, explicit light, system dark, explicit dark), and let
components consume only those active tokens with the canonical fallback chain.

## Absolute Bans

These patterns appear in the majority of AI-generated interfaces. Each has a specific rewrite.

| Pattern | Why | Rewrite |
|---|---|---|
| `border-left` or `border-right` wider than 1px as a section accent | The single most overused "design touch" in admin UIs; looks like a mistake beyond a hairline divider | Use a colored dot, short horizontal rule, background swatch, or typographic weight shift instead |
| `background-clip: text` gradient text | Decorative rather than meaningful; illegible when printed or in high-contrast mode | Use a solid brand color, tinted neutral, or typographic weight for emphasis |
| `backdrop-filter: blur` glassmorphism as the default card surface | Expensive on low-power devices; overused; layered-depth illusion breaks with a solid border | Use elevated surfaces via background color steps and `box-shadow` |
| Purple-to-blue gradients or cyan-on-dark accent systems | The canonical "AI design" color palette; communicates nothing about the brand | Pick a palette from brand words via the OKLCH rules above |
| `border-radius: 9999px` on containers and section cards | Pill radius on large containers looks bloated and unanchored; intended for small elements (pills, toggles, avatars) | Use the project's radius roles; containers get `--radius-card` or `--radius-modal` at most |
| Generic rounded-rect card with `box-shadow` as the default container | Template thinking; applies the same container to every content type | Default to cardless sections; only add card treatment when content type requires it |
| Modals as a lazy escape for overflow UI | Interrupts flow and breaks browser back navigation | Inline expand, detail panel, or dedicated route; modals only when the action truly requires focus-lock |
| `transition: all` or animating width/height/padding/margin | Forces layout recalculation on every frame | List exact properties; use `grid-template-rows: 0fr` to `1fr` for height reveals |

## Motion Specifics

| Property | Value | Notes |
|---|---|---|
| Entrance duration | 200-400ms | Ease-out (decelerate into rest position) |
| Exit duration | 150-250ms | Ease-in (accelerate out of view); shorter and softer than entrance |
| Easing (entrance) | `cubic-bezier(0.16, 1, 0.3, 1)` | Exponential ease-out; no bounce or elastic |
| Easing (exit) | `ease-in` or `cubic-bezier(0.4, 0, 1, 1)` | Quick departure |
| Max motion types per page | 2-3 | More than 3 distinct motion patterns creates visual noise |
| Stagger delay | ~80-100ms per element | Titles at ~80ms per word, content chunks at ~100ms |
| Icon swap | 120ms cross-fade | `opacity` + subtle `scale(0.9)` to `scale(1)`; no rotation unless semantically meaningful |
| Height reveal | `grid-template-rows: 0fr` to `1fr` | Avoids the `height: auto` animation trap |
| Page transition | ≤300ms | View Transitions API or equivalent; crossfade / shared-element morph / directional slide — one style per site, with a reduced-motion fallback |
| Scroll reveal | translate ≤24px, stagger 80-100ms | Trigger at ~20% visibility; once-only (never re-animate on scroll-up); opacity + translate (+ optional `blur(4px)→0`) |
| Animate only | `transform`, `opacity`, `filter` | Every other property triggers layout or paint |

No bounce or elastic easing. Real objects decelerate smoothly. Do not use `transition: all` even as a prototype shortcut.

## Motion Libraries — GSAP & Three.js

Reach for a JS motion library only when the locked direction needs what CSS and the View Transitions API cannot express: scroll-*scrubbed* timelines (progress-driven, not merely triggered), pinned sequences, or real-time 3D. Entrances, hovers, toggles, and trigger-once reveals stay on CSS + IntersectionObserver — a library there is weight without payoff. A library is something the design writes *against*, not a new capability that relaxes the rules: the perf budgets, the 2–3-motion-types cap, the `transform`/`opacity`/`filter`-only rule, and `prefers-reduced-motion` all still bind. Current APIs only — no pre-2024 patterns.

### GSAP + ScrollTrigger

| Rule | Why |
|---|---|
| Scope every animation in `gsap.context(() => {…}, scopeEl)` and call `ctx.revert()` on teardown/unmount | Tweens and triggers left alive across a route change leak memory and double-bind on return — a console-error and jank source the perf gate catches |
| Branch reduced vs full motion with `gsap.matchMedia()` keyed on `(prefers-reduced-motion: reduce)`, never a bare `if` | matchMedia tears the wrong-branch animations down automatically when the query flips; a hand-rolled `if` leaves them registered |
| `ScrollTrigger.kill()`/`.revert()` on every trigger you create; `ScrollTrigger.refresh()` after async content shifts layout | Orphan triggers fire against stale positions → CLS and reveals in the wrong place |
| Scrub `transform`/`opacity` only — never `width`, `height`, `top` | Same layout/paint rule as Motion Specifics; scrubbed layout props blow the "no >50ms long task" budget frame after frame |
| The reduced-motion branch is the *calm* composition, not a dead one | Meets the reduced-motion craft bar: a static, deliberate state, not a disabled afterthought |

### Three.js / WebGL

| Rule | Why |
|---|---|
| Lazy-load and code-split the 3D bundle; keep it off the critical path | A WebGL hero that blocks first paint fails LCP ≤2.5s outright |
| Cap `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5–2))` | Uncapped DPR on retina/mobile quadruples fragment work → dropped frames |
| Pause the `requestAnimationFrame` loop when the canvas is offscreen (IntersectionObserver) and on `visibilitychange` | A loop running behind the fold or in a hidden tab burns battery and INP for nothing |
| `dispose()` every geometry, material, texture, and the renderer on teardown | GPU resources are not garbage-collected — this is the #1 Three.js leak |
| Prefer WebGPU/TSL with a WebGL fallback; ship a **static** fallback (poster image / CSS) when WebGL is unavailable OR reduced-motion is set | The 3D is an enhancement over an accessible baseline, never the baseline itself |

Both libraries: motion and 3D layer over a working, accessible baseline — core content and navigation never depend on the library running.

## Section Separator Vocabulary

Every boundary between page sections is a design decision. Boards and final pages pick each boundary's treatment from this menu — "plain whitespace" is a legitimate pick, but it must be stated, never defaulted into. No two consecutive boundaries repeat the same treatment (the variety rule applies to joins, not just layouts).

| Treatment | When to use |
|---|---|
| Whitespace scale-shift | Quiet editorial rhythm; jump the section gap a full step (e.g., `--space-8` → `--space-12`) so the pause itself reads as the divider |
| Hairline rule | Dense, structured content; a 1px `--ui-border` line, often inset from the edges to feel typographic |
| Color band / background shift | Signal a change of register (proof, pricing); adjacent section canvases step by ≥4% lightness or switch to a tinted surface |
| Angled clip-path | Energetic, brand-forward pages; keep one consistent angle site-wide (2–6°) and never alternate directions per boundary |
| Curve / wave | Softer brands; ONE gentle curve, not a repeating wave pattern — and at most one curved boundary style per page |
| Overlap & negative margin | Hero-to-content or card-to-band joins; the next section's lead element breaks the boundary by 24–48px for depth |
| Gradient fade | Atmospheric/textured canvases; fade one canvas into the next over 80–160px instead of a hard edge |
| Full-bleed image band | Chaptering long pages; an edge-to-edge visual (with contrast-safe treatment) acts as the divider |
| Marquee / ticker divider | Playful or fashion-adjacent directions; a single-line scrolling strip (logos, keywords) — honors `prefers-reduced-motion` by pausing |

## Work design scaffold

For multi-page or production UIs, create the active work's
`design/<design-slug>.md` before the first component. The 13-section structure,
two-tier token tables, component specifications, decision log, evidence map,
and “Motion, Transitions & Separators” specification live in
`design.template.md`. Sections 10–13 are the domain handoff contract; whole-work
context and planning stay in `state.md`.

For a single component or quick prototype, use a lightweight design child with
the shared metadata, three-line visual thesis, decisions, evidence paths,
implementation mapping, and next action. Evidence still belongs under
`artifacts/design/<design-slug>/`.

## AI Slop Test

Would a stranger glancing at the first viewport immediately say "an AI made this"? If yes, the design direction was not committed enough. The usual culprits:

1. Reflex font (Inter, Roboto, Poppins, or system-ui at display sizes)
2. Default purple/blue accent with no brand connection
3. Centered hero with generic card grid beneath
4. Uniform card sizing with identical shadows and padding

Fix the typography, the color system, or the layout until the answer flips. If more than one culprit applies, fix all of them.

---

*Adapted from [Waza](https://github.com/tw93/Waza) design skill references. Font, color, motion, and AI slop rules draw on [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache 2.0). Design scaffold concept credited to [getdesign.md](https://getdesign.md) (MIT).*
