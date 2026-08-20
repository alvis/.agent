# {{PROJECT_NAME}} — {{DESIGN_TITLE}}

> {{ONE_SENTENCE_DESIGN_PHILOSOPHY}}

> **Status**: {{draft|approved|implemented|promoted|superseded}} · **Headline**: {{ONE_LINE_HEADLINE}} · **Owner**: {{OWNER}}

> **Work**: `{{WORK_ID}}` · **State**: `../state.md` · **Artifacts**: `../artifacts/design/{{DESIGN_SLUG}}/` · **Created**: {{ISO_8601}}

> **Provenance**: {{SOURCE_URLS_PATHS_REVISIONS_AND_PRIOR_DESIGN_REFS}}

> **Handoff contract**: Sections 10–13 are mandatory and current at every save point. Whole-work context and planning remain in `state.md`; this file owns design detail and visual decisions.

---

## 1. Visual Theme & Atmosphere

**Mood**: {{MOOD_DESCRIPTION — e.g., "Clean and confident with subtle warmth. Professional but approachable."}}

**Canvas**: The base canvas is `{{CANVAS_COLOR}}` in light mode and `{{CANVAS_COLOR_DARK}}` in dark mode. Content floats on elevated surfaces to create depth without visual noise.

**Accent Philosophy**: {{ACCENT_PHILOSOPHY — e.g., "A single vibrant primary color is used sparingly for CTAs and active states. Accents support without competing. The palette stays calm — accents earn attention by being rare."}}

**Visual Language**: {{VISUAL_LANGUAGE — e.g., "Rounded corners, generous whitespace, and subtle shadows. Motion is restrained and purposeful — elements ease in, never bounce."}}

---

## 2. Color Palette & Roles

Two-tier mode tokens (CSS-MODE-04): components consume **tier-2 `--ui-<role>` only**. Each tier-2 token is fed by a `--theme-light-<role>` / `--theme-dark-<role>` tier-1 pair living inside `@layer theme`, scaffolded by the `web:css` skill — never referenced from component CSS. The Light/Dark columns below are the tier-1 values.

> Legacy token migration: `--color-primary`→`--ui-primary` · `--color-secondary`→`--ui-accent` · `--surface-canvas`→`--ui-bg` · `--surface-primary`→`--ui-surface` · `--surface-secondary`→`--ui-surface-sunken` · `--surface-overlay`→`--ui-overlay` · `--text-primary`→`--ui-fg` · `--text-secondary`→`--ui-fg-muted` · `--text-tertiary`→`--ui-fg-subtle` · `--text-inverse`→`--ui-fg-inverse` · `--border-default`→`--ui-border` · `--border-strong`→`--ui-border-strong` · `--border-focus`→`--ui-focus-ring` · `--color-error*`→`--ui-danger*` · `--shadow-1..4`→`--ui-shadow-card|raised|overlay` · `--radius-sm/md/lg/xl`→`--radius-control|card|modal` · `--space-2xs..3xl`→`--space-1..12`.

### Primary & Accent

| Tier-2 Token (components use this) | Role | Tier-1 Light (`--theme-light-<role>`) | Tier-1 Dark (`--theme-dark-<role>`) |
|---|---|---|---|
| `--ui-primary` | Primary brand / CTAs | `{{#6366f1}}` | `{{#818cf8}}` |
| `--ui-primary-hover` | Primary hover state | `{{#4f46e5}}` | `{{#a5b4fc}}` |
| `--ui-primary-active` | Primary pressed state | `{{#4338ca}}` | `{{#c7d2fe}}` |
| `--ui-primary-subtle` | Primary tinted backgrounds | `{{#eef2ff}}` | `{{#1e1b4b}}` |
| `--ui-accent` | Secondary actions / accents | `{{#06b6d4}}` | `{{#22d3ee}}` |
| `--ui-accent-hover` | Accent hover state | `{{#0891b2}}` | `{{#67e8f9}}` |
| `--ui-accent-subtle` | Accent tinted backgrounds | `{{#ecfeff}}` | `{{#164e63}}` |

### Surfaces

| Tier-2 Token (components use this) | Role | Tier-1 Light (`--theme-light-<role>`) | Tier-1 Dark (`--theme-dark-<role>`) |
|---|---|---|---|
| `--ui-bg` | Page background | `{{#ffffff}}` | `{{#0a0a0a}}` |
| `--ui-surface` | Card / panel background | `{{#ffffff}}` | `{{#141414}}` |
| `--ui-surface-sunken` | Nested / recessed areas | `{{#f9fafb}}` | `{{#1a1a1a}}` |
| `--ui-overlay` | Modal / dropdown backdrop | `{{rgba(0,0,0,0.5)}}` | `{{rgba(0,0,0,0.7)}}` |

### Text & Borders

| Tier-2 Token (components use this) | Role | Tier-1 Light (`--theme-light-<role>`) | Tier-1 Dark (`--theme-dark-<role>`) |
|---|---|---|---|
| `--ui-fg` | Headings, body text | `{{#111827}}` | `{{#f9fafb}}` |
| `--ui-fg-muted` | Supporting text | `{{#6b7280}}` | `{{#9ca3af}}` |
| `--ui-fg-subtle` | Placeholder, disabled | `{{#9ca3af}}` | `{{#6b7280}}` |
| `--ui-fg-inverse` | Text on primary color | `{{#ffffff}}` | `{{#ffffff}}` |
| `--ui-border` | Default borders | `{{#e5e7eb}}` | `{{#2a2a2a}}` |
| `--ui-border-strong` | Emphasized borders | `{{#d1d5db}}` | `{{#404040}}` |
| `--ui-focus-ring` | Focus ring color | `{{#6366f1}}` | `{{#818cf8}}` |

### Feedback

| Tier-2 Token (components use this) | Role | Tier-1 Light (`--theme-light-<role>`) | Tier-1 Dark (`--theme-dark-<role>`) |
|---|---|---|---|
| `--ui-success` | Positive / confirmed | `{{#16a34a}}` | `{{#4ade80}}` |
| `--ui-success-subtle` | Success background | `{{#f0fdf4}}` | `{{#052e16}}` |
| `--ui-warning` | Caution / attention | `{{#d97706}}` | `{{#fbbf24}}` |
| `--ui-warning-subtle` | Warning background | `{{#fffbeb}}` | `{{#422006}}` |
| `--ui-danger` | Destructive / invalid | `{{#dc2626}}` | `{{#f87171}}` |
| `--ui-danger-subtle` | Danger background | `{{#fef2f2}}` | `{{#450a0a}}` |
| `--ui-info` | Informational | `{{#2563eb}}` | `{{#60a5fa}}` |
| `--ui-info-subtle` | Info background | `{{#eff6ff}}` | `{{#172554}}` |

---

## 3. Typography Rules

| Token | Value | Usage |
|---|---|---|
| `--font-display` | `{{FONT_DISPLAY — e.g., "'Space Grotesk', -apple-system, sans-serif"}}` | Headings, hero display |
| `--font-body` | `{{FONT_BODY — e.g., "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"}}` | Body copy, UI text |
| `--font-mono` | `{{MONO_FONT — e.g., "'JetBrains Mono', ui-monospace, monospace"}}` | Code, tabular data |

**Scale Ratio**: {{SCALE_RATIO — e.g., 1.25 (Major Third)}}

The type scale is documented as a table — no per-level size tokens (`--text-body-lg` would violate WT-VARIANT-01). Mint a role type token (e.g. `--text-display`, `--text-eyebrow`) only where element defaults or utilities cannot express the role.

| Level | Size | Weight | Line Height | Letter Spacing | Usage |
|---|---|---|---|---|---|
| Display XL | `{{3.5rem}}` | `{{800}}` | `{{1.1}}` | `{{-0.03em}}` | Hero headlines |
| Display | `{{3rem}}` | `{{800}}` | `{{1.1}}` | `{{-0.025em}}` | Page hero |
| H1 | `{{2.25rem}}` | `{{700}}` | `{{1.2}}` | `{{-0.02em}}` | Page titles |
| H2 | `{{1.875rem}}` | `{{700}}` | `{{1.25}}` | `{{-0.015em}}` | Section headings |
| H3 | `{{1.5rem}}` | `{{600}}` | `{{1.3}}` | `{{-0.01em}}` | Subsection headings |
| H4 | `{{1.25rem}}` | `{{600}}` | `{{1.35}}` | `{{-0.005em}}` | Card titles |
| H5 | `{{1.125rem}}` | `{{600}}` | `{{1.4}}` | `{{0}}` | Sub-headers |
| H6 | `{{1rem}}` | `{{600}}` | `{{1.4}}` | `{{0}}` | Labels, captions |
| Body LG | `{{1.125rem}}` | `{{400}}` | `{{1.6}}` | `{{0}}` | Lead paragraphs |
| Body | `{{1rem}}` | `{{400}}` | `{{1.6}}` | `{{0}}` | Default body text |
| Body SM | `{{0.875rem}}` | `{{400}}` | `{{1.5}}` | `{{0.005em}}` | Secondary text |
| Caption | `{{0.75rem}}` | `{{500}}` | `{{1.4}}` | `{{0.01em}}` | Captions, meta |
| Tiny | `{{0.625rem}}` | `{{500}}` | `{{1.4}}` | `{{0.02em}}` | Badges, fine print |

---

## 4. Component Stylings

### Buttons

**Base**: `padding: {{0.625rem 1.25rem}}; border-radius: var(--radius-control); font-weight: 600; font-size: 0.875rem; transition: background-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;`

| Variant | Background | Text | Border |
|---|---|---|---|
| Primary | `var(--ui-primary)` | `var(--ui-fg-inverse)` | none |
| Secondary | `transparent` | `var(--ui-primary)` | `1px solid var(--ui-primary)` |
| Ghost | `transparent` | `var(--ui-fg)` | none |
| Danger | `var(--ui-danger)` | `var(--ui-fg-inverse)` | none |

**Interactive States**:

| State | Treatment | Notes |
|---|---|---|
| Hover | Switch to the variant's hover token (e.g. `var(--ui-primary-hover)`), `translateY(-1px)`, add subtle shadow | Cursor pointer |
| Active | Switch to the active token (e.g. `var(--ui-primary-active)`), `translateY(0)`, remove shadow | Instant feedback |
| Disabled | `opacity: 0.5; cursor: not-allowed;` | No pointer events |
| Focus | `box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-focus-ring) 30%, transparent)` | Always visible ring |

### Cards

| Variant | Background | Border | Shadow | Hover |
|---|---|---|---|---|
| Default | `var(--ui-surface)` | `1px solid var(--ui-border)` | `var(--ui-shadow-card)` | -- |
| Elevated | `var(--ui-surface)` | none | `var(--ui-shadow-raised)` | -- |
| Interactive | `var(--ui-surface)` | `1px solid var(--ui-border)` | `var(--ui-shadow-card)` | `var(--ui-shadow-raised)`, `translateY(-2px)` |

### Inputs

**Base**: `padding: {{0.625rem 0.75rem}}; border-radius: var(--radius-control); font-size: 1rem; border: 1px solid var(--ui-border); transition: border-color 150ms ease, box-shadow 150ms ease;`

| State | Border | Shadow | Label |
|---|---|---|---|
| Default | `var(--ui-border)` | none | `var(--ui-fg-muted)` |
| Focus | `var(--ui-primary)` | `0 0 0 3px var(--ui-primary-subtle)` | `var(--ui-primary)` |
| Error | `var(--ui-danger)` | `0 0 0 3px var(--ui-danger-subtle)` | `var(--ui-danger)` |
| Disabled | `var(--ui-border)` | none | `var(--ui-fg-subtle)`, bg `var(--ui-surface-sunken)` |

### Navigation

- **Top bar**: `height: {{3.5rem}}; background: var(--ui-surface); border-bottom: 1px solid var(--ui-border); backdrop-filter: blur(12px);`
- **Active item**: `color: var(--ui-primary); font-weight: 600;` with bottom indicator (`2px solid var(--ui-primary)`)
- **Mobile**: Hamburger menu at `{{768px}}` breakpoint, slide-in drawer from left

### Images

- **Border radius**: `var(--radius-card)` for standalone images, `var(--radius-control)` for images inside cards
- **Aspect ratio**: Use `aspect-ratio: {{16/9}}` for hero, `{{1/1}}` for avatars, `{{4/3}}` for cards
- **Loading**: Skeleton placeholder with `var(--ui-surface-sunken)` background and shimmer animation
- **Object fit**: `object-fit: cover` for fills, `object-fit: contain` for logos

### Motion, Transitions & Separators

The World-Class Element Checklist spec for this project (values follow [Motion Specifics](design-reference.md#motion-specifics); picks come from the connective-tissue board):

- **Page transition**: {{STYLE — e.g., "View Transitions API crossfade + 8px upward drift, 240ms cubic-bezier(0.16, 1, 0.3, 1)"}}
- **Scroll-reveal language**: {{TRIGGER, DISTANCE, STAGGER — e.g., "IntersectionObserver at 20% visibility; opacity 0→1 + translateY(16px)→0; 90ms stagger per chunk; once-only"}}
- **Signature micro-interaction**: {{FROM_DIRECTION_QUESTION_5 — e.g., "CTA magnetic hover: 4px cursor-follow + scale(1.02)"}}
- **Reduced motion**: {{BEHAVIOR — e.g., "reveals become instant opacity fades; page transition falls back to plain crossfade; parallax disabled"}}

**Section separators** (every boundary deliberate; no two consecutive boundaries repeat):

| Boundary | Treatment |
|---|---|
| {{Hero → Features}} | {{e.g., "gradient fade from hero canvas into `--ui-surface-sunken`"}} |
| {{Features → Social proof}} | {{e.g., "full-bleed color band with overlap: cards break the boundary by −32px"}} |

**Hover & focus treatments** (every interactive element class):

| Element class | Hover | `:focus-visible` |
|---|---|---|
| {{Links}} | {{e.g., "underline grows in 150ms from left"}} | {{e.g., "2px `--ui-focus-ring` outline, 2px offset"}} |
| {{Cards}} | {{e.g., "`--ui-shadow-raised` + translateY(-2px)"}} | {{same ring on the card surface}} |
| {{Images}} | {{e.g., "scale(1.03) inside overflow-hidden frame, 300ms"}} | {{ring on the wrapping link}} |

**Dynamic-region states**: {{PER REGION — loading/skeleton, empty, error designs, e.g., "testimonial wall: shimmer skeleton rows; empty → quote CTA; error → muted retry inline"}}

---

## 5. Layout Principles

**Base Unit**: `4px`

**Max Content Width**: `{{1280px}}`

### Spacing Scale

Fixed 4px-grid primitives (mode-independent, plain `:root` tokens):

| Token | Value | Usage |
|---|---|---|
| `--space-1` | `0.25rem` (4px) | Inline icon gaps |
| `--space-2` | `0.5rem` (8px) | Tight element gaps |
| `--space-3` | `0.75rem` (12px) | Form field gaps |
| `--space-4` | `1rem` (16px) | Default component padding |
| `--space-5` | `1.5rem` (24px) | Card padding, section gaps |
| `--space-6` | `2rem` (32px) | Between sections |
| `--space-7` | `2.5rem` (40px) | Large component separation |
| `--space-8` | `3rem` (48px) | Page-level vertical rhythm |
| `--space-9` | `3.5rem` (56px) | Major block separation |
| `--space-10` | `4rem` (64px) | Hero / major section breaks |
| `--space-11` | `5rem` (80px) | Oversized section breaks |
| `--space-12` | `6rem` (96px) | Maximum single spacing value |

### Border Radius Roles

Role-named tokens only (WT-VARIANT-01) — names express what the radius is FOR, never its size:

| Token | Value | Usage |
|---|---|---|
| `--radius-control` | `{{0.5rem}}` | Buttons, inputs, selects, chips |
| `--radius-card` | `{{0.75rem}}` | Cards, panels, standalone images |
| `--radius-modal` | `{{1rem}}` | Modals, sheets, large surfaces |

Fully-round elements (avatars, pills, toggles) use the `9999px` literal — a shape constant, not a theme decision, so it is never a token.

### Grid System

- **Columns**: `{{12}}`
- **Column gap**: `var(--space-5)`
- **Row gap**: `var(--space-5)`
- **Container padding**: `var(--space-4)` (mobile), `var(--space-6)` (desktop)

---

## 6. Depth & Elevation

Shadows are mode-dependent — they go through the two-tier chain like colors. Dark-mode values use light-overlay stepping (semi-transparent white rings/washes), because drop shadows are nearly invisible on dark surfaces (see [Surfaces](design-reference.md#surfaces)).

| Tier-2 Token | Role | Tier-1 Light | Tier-1 Dark |
|---|---|---|---|
| `--ui-shadow-card` | Cards, subtle lift | `{{0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)}}` | `{{0 0 0 1px rgba(255,255,255,0.05)}}` |
| `--ui-shadow-raised` | Hovered cards, dropdowns | `{{0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)}}` | `{{0 0 0 1px rgba(255,255,255,0.08)}}` |
| `--ui-shadow-overlay` | Modals, popovers, floating panels | `{{0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)}}` | `{{0 0 0 1px rgba(255,255,255,0.10), 0 10px 15px rgba(0,0,0,0.5)}}` |

Flat elements simply omit `box-shadow` — there is no "level 0" token.

---

## 7. Do's and Don'ts

### Do

1. Use `var(--ui-primary)` for all CTA buttons — never hardcode hex values
2. Maintain `4px` grid alignment — all spacing values are multiples of the base unit
3. Use the type scale levels exactly as defined — do not invent in-between sizes
4. Apply `var(--ui-shadow-*)` tokens for elevation — keep depth usage consistent
5. Use feedback tokens (`--ui-success`, `--ui-danger`) for status states
6. Set `border-radius: var(--radius-control)` on interactive elements for a cohesive feel
7. Animate with explicit properties (`transition: background-color 150ms ease`) for micro-interactions — keep it subtle
8. Provide visible `:focus` styles on every interactive element (keyboard accessibility)
9. Use `var(--ui-surface-sunken)` for nested or recessed content areas
10. Test every component at all breakpoints AND in both color modes before considering it complete

### Don't

1. Do not use more than {{2}} accent colors simultaneously in a single view
2. Do not set `font-size` below the Tiny level (`{{0.625rem}}`) — it fails readability
3. Do not use `box-shadow` values outside the `--ui-shadow-*` set
4. Do not mix `px` and `rem` for the same property in a single component
5. Do not rely on color alone to convey meaning — always pair with icon or text
6. Do not use more than {{3}} font weights on a single screen
7. Do not place interactive elements closer than `{{8px}}` to each other (touch target clearance)
8. Do not exceed `--space-12` for any single spacing value
9. Do not use `opacity` below `0.5` for disabled states — it becomes invisible on some displays
10. Do not reference `--theme-light-*` / `--theme-dark-*` from component CSS — tier-1 lives only in `@layer theme`

---

## 8. Responsive Behavior

### Breakpoints

| Name | Value | Target |
|---|---|---|
| sm | `{{640px}}` | Mobile landscape |
| md | `{{768px}}` | Tablets |
| lg | `{{1024px}}` | Small desktop / landscape tablet |
| xl | `{{1280px}}` | Desktop |
| 2xl | `{{1536px}}` | Wide desktop |

### Touch Targets

- Minimum interactive size: `{{44px}}` (stricter project rule, not WCAG AA)
- Minimum spacing between targets: `{{8px}}`
- Mobile CTAs: full-width below the sm breakpoint

### Collapsing Strategy

| Component | Desktop | Tablet | Mobile |
|---|---|---|---|
| Navigation | Horizontal top bar | Horizontal top bar | Hamburger + drawer |
| Grid | {{12}} columns | {{8}} columns | {{4}} columns (or single stack) |
| Sidebar | Visible | Collapsible panel | Hidden, triggered by icon |
| Cards | {{3}}-column grid | {{2}}-column grid | Single stack |
| Tables | Full table | Horizontally scrollable | Card-per-row layout |
| Modals | Centered dialog | Centered dialog | Full-screen sheet |

---

## 9. Agent Prompt Guide

### CSS Variable Quick-Reference

```css
/* Tier-2 color & surface tokens — components consume ONLY these */
var(--ui-bg)              var(--ui-surface)        var(--ui-surface-sunken)  var(--ui-overlay)
var(--ui-fg)              var(--ui-fg-muted)       var(--ui-fg-subtle)       var(--ui-fg-inverse)
var(--ui-primary)         var(--ui-primary-hover)  var(--ui-primary-active)  var(--ui-primary-subtle)
var(--ui-accent)          var(--ui-accent-hover)   var(--ui-accent-subtle)
var(--ui-border)          var(--ui-border-strong)  var(--ui-focus-ring)
var(--ui-success)         var(--ui-warning)        var(--ui-danger)          var(--ui-info)
var(--ui-success-subtle)  var(--ui-warning-subtle) var(--ui-danger-subtle)   var(--ui-info-subtle)

/* Mode-dependent shadows */
var(--ui-shadow-card)     var(--ui-shadow-raised)  var(--ui-shadow-overlay)

/* Primitives (mode-independent) */
var(--space-1) … var(--space-12)   /* 4px grid: 4 8 12 16 24 32 40 48 56 64 80 96 */
var(--radius-control) var(--radius-card) var(--radius-modal)  /* fully-round = 9999px literal */
var(--font-display) var(--font-body) var(--font-mono)
```

### Example Component Prompts

**Prompt 1 — Hero Section**:
> "Build a hero section with a Display XL heading in `var(--ui-fg)` set in `var(--font-display)`, a Body LG subtitle in `var(--ui-fg-muted)`, and a primary CTA button using `var(--ui-primary)` with `var(--radius-control)`. Add `var(--space-10)` vertical padding. On mobile, stack vertically and make the CTA full-width."

**Prompt 2 — Feature Card Grid**:
> "Create a 3-column grid of interactive cards (`var(--ui-surface)`, `var(--ui-shadow-card)`, `var(--radius-card)`). Each card has an icon, an H4 title, and Body SM description. On hover, lift to `var(--ui-shadow-raised)` with `translateY(-2px)`. Collapse to single column below the md breakpoint. Gap is `var(--space-5)`."

**Prompt 3 — Settings Form**:
> "Design a settings form on `var(--ui-surface-sunken)` with `var(--space-5)` padding and `var(--radius-card)` corners. Use the Input styling from the design system (focus ring with `var(--ui-primary-subtle)`). Group fields in sections with H5 headings. Place the Save button (primary variant) at the bottom-right. Show error states with `var(--ui-danger)` border and helper text."

---

## 10. Design Context & Decision Log

**Target and audience**: {{TARGET_AUDIENCE_PRIMARY_TASK_AND_USAGE_CONTEXT}}

**Inputs and constraints**: {{URL_SCREENSHOT_CODE_FIGMA_BRAND_ACCESSIBILITY_RESPONSIVE_PERFORMANCE_CONTENT}}

**Authorization**: {{design-only|implementation-authorized|ambiguous}}

**Artifacts root**: `../artifacts/design/{{DESIGN_SLUG}}/`

**Chosen direction** (3-line Direction Summary, verbatim from the direction gate):

> {{DIRECTION_SUMMARY_LINE_1}}
> {{DIRECTION_SUMMARY_LINE_2}}
> {{DIRECTION_SUMMARY_LINE_3}}

**Rejected direction candidates**:

| Candidate | Why rejected |
|---|---|
| {{CANDIDATE_NAME}} | {{ONE_LINE_RATIONALE}} |

**Per-area design picks** (one row per area board, recorded immediately after each pick):

| Area | Chosen variant (# + name) | Rejected variants + one-line why |
|---|---|---|
| {{Hero}} | {{#2 "Split editorial"}} | {{#1 too dense for the audience; #3 weaker hierarchy / repeated separator / off-direction imagery}} |
| {{Connective tissue}} | {{#1 "Fade + band system"}} | {{#2–3 one-line reasons}} |

**Exemplar sites** (facelift runs — the rubric anchors):

| Exemplar | What it anchors |
|---|---|
| {{EXEMPLAR_URL}} | {{TECHNIQUE / QUALITY BAR IT REPRESENTS}} |

**Hard constraints**: {{BRAND_RULES, LEGAL, PLATFORM, PERFORMANCE — anything that binds the design}}

**Decision log** (every presented candidate, pick, rejection, confirmation, and follow-up; dated):

| Date | Decision ID | Area/question | Presented and ranked | Chosen | Rejected + reason | Confirmation/next action |
|---|---|---|---|---|---|---|
| {{YYYY-MM-DD}} | {{d-001}} | {{Direction}} | {{#1..#N with concrete details}} | {{pick/merge}} | {{alternatives + reason}} | {{user/quick rationale + follow-up}} |

---

## 11. Component Inventory & Sources

Every component this design touches, where it comes from, and its reuse status:

| Component | Source | Path | Consumers | Promotion status / follow-up |
|---|---|---|---|---|
| {{Button}} | {{library / patched-upstream / local}} | {{src/components/ui/button.tsx}} | {{routes/features using it}} | {{e.g. "local — promote to packages/ui when checkout ships (second consumer)"}} |

Source values: `library` (consumed as-is or via theme bridge), `patched-upstream` (change landed in the shared package), `local` (lives at the lowest tier per RPS-LAYOUT-01).

---

## 12. Implementation State & Next Steps

**Built so far** (paths + one-line status):

- {{path}} — {{status}}

**Current slice / phase**: {{WHERE_WORK_STOPPED}}

**Per-slice ledger** (facelift runs — append one block per slice):

```
Slice: <name>
Change: <what changed>
Technique: <named technique + exemplar it borrows from>
Critic: <score per axis> — divergence cited: <exemplar>: <specific difference>
Metrics: LCP <n>s · INP <n>ms · CLS <n> · long tasks <n> · contrast <pass/fail>
Status: pass | rework (<reason>)
Save point: <jj change id>
```

**Known issues**: {{ANYTHING_FAILING_OR_DEFERRED}}

**Promotion candidates**:

| Knowledge | Destination | Disposition | Provenance/review |
|---|---|---|---|
| {{system-wide or non-system design rule}} | {{docs/design/system.md or docs/design/<slug>.md}} | {{candidate|promoted|rejected}} | {{work/review/evidence refs}} |

**Next actions** (exact, ordered — a fresh agent starts at #1):

1. {{NEXT_ACTION}}
2. {{NEXT_ACTION}}

---

## 13. File Map

| Artifact | Path |
|---|---|
| Theme stylesheet (`@layer theme`, scaffolded by `web:css`) | {{src/styles/theme.css}} |
| Preview catalog | `../artifacts/design/{{DESIGN_SLUG}}/previews/tokens/preview.html` |
| Preview screenshots | `../artifacts/design/{{DESIGN_SLUG}}/previews/tokens/screenshot*.webp` |
| This design contract | `./{{DESIGN_SLUG}}.md` |
| Key component directories | {{src/components/ui/, packages/ui/…}} |
| Whole-work state | `../state.md` |
| Design boards and rendered images | `../artifacts/design/{{DESIGN_SLUG}}/boards/*` |
| Facelift inventories | `../artifacts/design/{{DESIGN_SLUG}}/inventories/facelift-inventory-before.json` / `-after.json` |
| Save points | {{jj change ids, newest last}} |
