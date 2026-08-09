# Design: Compliant Design Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.
> **Compliance**: Also follow `scan.md` in this directory to avoid violations during writing. When unsure about a specific rule, consult its detailed guidance in `rules/<rule-id>.md`.

## Key Principles

- Establish clear visual hierarchy with distinct primary/secondary/tertiary levels so users identify the primary task in under 3 seconds
- Lead with typography -- use a consistent type scale (ratio-based) and purposeful font weights to create hierarchy before reaching for color or decoration
- Anchor all spacing to a base grid (4px/8px) so margins, padding, and gaps are predictable and harmonious
- Define complete interactive states for every control: default, hover, active, focus-visible, and disabled with explanation
- Design every UI state explicitly: loading (skeleton/spinner), empty (explanation + next step), error (problem + cause + fix), success (confirmation + next action), and permission (why blocked + how to request)
- Treat WCAG AA as the accessibility floor: contrast ratios, keyboard access, ARIA labels, touch targets >= 44px, and visible focus indicators are non-negotiable
- Use a single icon set consistently; reserve icon-only affordances for universally understood actions (search, close, menu) and label everything else
- Use animation only to communicate hierarchy changes or state transitions -- keep motion subtle (fade, small translate) and layout-stable
- Express brand personality through restrained color, spacious layout, and typographic voice -- never through dark patterns or decorative excess

## Core Rules Summary

### Visual Hierarchy & Layout (DES-HIER)

- **DES-HIER-01**: Maintain distinct primary/secondary/tertiary visual levels via size, color, position, and whitespace; structure content for F/Z-pattern scanning; apply CRAP (contrast, repetition, alignment, proximity); use whitespace intentionally.
- **DES-HIER-02**: Give the primary CTA the highest visual weight in each section; limit to one primary CTA per screen/section; primary task identifiable in <3 seconds.

### Typography (DES-TYPO)

- **DES-TYPO-01**: Limit typefaces to 2-3 families maximum; follow a consistent type scale with ratio 1.125-1.333; use font weights purposefully.
- **DES-TYPO-02**: Set body line-height 1.4-1.6, heading line-height 1.1-1.3, line length 50-75ch, min 14px body on mobile.

### Color & Contrast (DES-COLR)

- **DES-COLR-01**: Build a small, intentional palette: one primary, one accent, neutrals, and semantic colors (red=error, green=success, yellow=warning, blue=info); never use color as sole indicator -- pair with icon/text/shape; support `prefers-color-scheme` when applicable.
- **DES-COLR-02**: Meet WCAG AA contrast minimums: normal text >= 4.5:1, large text >= 3:1, UI components >= 3:1.

### Spacing & Grid (DES-SPAC)

- **DES-SPAC-01**: Derive all spacing from a 4px/8px base grid; reject arbitrary values; align to grid with zero pixel drift; set `max-width` on content containers.
- **DES-SPAC-02**: Use tight spacing within groups and loose spacing between groups (proximity principle).

### Consistency & Tokens (DES-CONS)

- **DES-CONS-01**: Use design tokens (CSS custom properties) instead of hardcoded color, spacing, and radius values; limit `border-radius` to max 4 distinct values; define consistent `box-shadow` scale.
- **DES-CONS-02**: Reuse the same components for the same purposes across all screens; same concept = same label everywhere; same gesture = same result.

### Accessibility (DES-A11Y)

- **DES-A11Y-01**: Make all interactive elements keyboard-accessible (Tab, Enter, Escape); provide visible focus indicators on every focusable element; never use `outline: none` without `:focus-visible` replacement; include skip-navigation link.
- **DES-A11Y-02**: Add ARIA labels on icon-only buttons and non-standard controls; associate every form input with `<label>` (not placeholder); meaningful `alt` on images; touch targets >= 44x44 CSS px (web) / 48x48 dp (mobile).

### States & Feedback (DES-STAT)

- **DES-STAT-01**: Implement all 5 UI states: loading (skeleton, no layout jumps, prevent double-submit), empty (explain + next step), error (what + why + fix, preserve input), success (confirm + next action), permission (why blocked + how to request).
- **DES-STAT-02**: Provide hover, active, disabled (with explanation), and focus pseudo-states on every interactive element.

### Navigation & IA (DES-NAVI)

- **DES-NAVI-01**: Organize navigation by user mental model (goal/object/time/status), not backend structure; provide search/filter/sort when items exceed ~7; keep navigation stable across similar screens.
- **DES-NAVI-02**: Clearly indicate user's current location (breadcrumbs, active highlight); use breadcrumbs or back nav for hierarchies >2 levels deep.

### Content & Microcopy (DES-COPY)

- **DES-COPY-01**: Label actions with concise verbs describing the outcome ("Save draft", "Send invite"), not generic words ("OK", "Submit"); layer help text progressively (L0=label, L1=placeholder, L2=inline, L3=tooltip); no jargon; consistent terminology.
- **DES-COPY-02**: Structure error messages as problem + cause + solution; write from user's task perspective, not implementation details.

### Responsiveness (DES-RESP)

- **DES-RESP-01**: Adapt layout at breakpoints 320/768/1024/1440+; no horizontal scroll; content reflows (WCAG 1.4.10 at 400%); mobile-first content ordering; images scale with `max-width: 100%`.
- **DES-RESP-02**: Touch targets >= 44px on mobile; primary actions in thumb zone; provide touch alternatives for hover-only interactions.

### Imagery, Icons & Motion (DES-ICON)

- **DES-ICON-01**: Single icon set (Lucide/Material Symbols/SF Symbols); no emoji; standardized sizes 16/20/24px; icon-only for universals only (search/close/more); label ambiguous icons.
- **DES-ICON-02**: Animation explains state changes only, not decoration; motion vocabulary: fade → translate+fade → scale+fade; layout stays stable; respect `prefers-reduced-motion`.

### Branding & Modern Standards (DES-BRND)

- **DES-BRND-01**: Express brand personality consistently through color, typography, and tone; restrained color, spacious layout, typography-led hierarchy signal modern design; avoid dated patterns.
- **DES-BRND-02**: No dark patterns (confirmshaming, hidden costs, trick questions, forced continuity); cancellation as easy as signup; opt-in for marketing; transparent, minimal data collection.

## Patterns

### Color Palette Construction

| Role | Token | Usage |
|---|---|---|
| Primary | `--color-primary` | Brand identity, primary CTA backgrounds, active navigation |
| Accent | `--color-accent` | Secondary actions, highlights, links |
| Neutral-50 | `--color-neutral-50` | Backgrounds, subtle dividers |
| Neutral-200 | `--color-neutral-200` | Borders, disabled backgrounds |
| Neutral-500 | `--color-neutral-500` | Placeholder text, secondary icons |
| Neutral-700 | `--color-neutral-700` | Body text |
| Neutral-900 | `--color-neutral-900` | Headings, high-emphasis text |
| Error | `--color-error` | Destructive actions, validation errors (red) |
| Success | `--color-success` | Confirmation, positive feedback (green) |
| Warning | `--color-warning` | Caution states, non-blocking alerts (yellow) |
| Info | `--color-info` | Informational banners, help context (blue) |

### Spacing Scale

4px base grid with doubling/stepping progression:

| Token | Value | Common Usage |
|---|---|---|
| `--space-1` | 4px | Inline icon gap, tight element padding |
| `--space-2` | 8px | Input padding, compact list gap |
| `--space-3` | 12px | Small card padding, form field gap |
| `--space-4` | 16px | Standard component padding, paragraph gap |
| `--space-5` | 20px | Medium section padding |
| `--space-6` | 24px | Card padding, form group gap |
| `--space-7` | 32px | Section separation |
| `--space-8` | 40px | Large section padding |
| `--space-9` | 48px | Page section gap |
| `--space-10` | 64px | Major section separation |
| `--space-11` | 80px | Hero padding, page-level spacing |
| `--space-12` | 96px | Maximum section separation |

### Type Scale

1.25 ratio (Major Third), base 16px:

| Level | Size | Weight | Line-Height | Usage |
|---|---|---|---|---|
| Display | 36px | 700 | 1.1 | Hero headlines, marketing pages |
| H1 | 28px | 700 | 1.2 | Page titles |
| H2 | 24px | 600 | 1.2 | Section headings |
| H3 | 20px | 600 | 1.3 | Subsection headings, card titles |
| Body-lg | 18px | 400 | 1.5 | Lead paragraphs, emphasis text |
| Body | 16px | 400 | 1.5 | Default body text |
| Body-sm | 14px | 400 | 1.5 | Secondary text, captions |
| Caption | 13px | 400 | 1.4 | Timestamps, metadata |
| Tiny | 12px | 500 | 1.4 | Badges, legal fine print |

## Anti-Patterns

- Flat hierarchy where every element has equal visual weight -- no clear primary action.
- Arbitrary spacing values (5px, 7px, 13px) instead of grid-aligned tokens.
- Hardcoded colors and magic numbers instead of design tokens and CSS custom properties.
- Missing UI states: no loading skeleton, generic "Something went wrong" errors, blank empty states.
- Icon soup: mixing outline, filled, and emoji icon styles in the same interface.
- Color as the sole differentiator for status or meaning without icon/text pairing.
- Placeholder text used as the only form label.
- `outline: none` on focusable elements without a `:focus-visible` replacement.
- Decorative animation that causes layout shifts or distracts from content.
- Dark patterns: confirmshaming, pre-checked marketing consent, hidden cancellation flows.

## Quick Decision Tree

1. **Hierarchy first**: Establish clear visual levels -- primary CTA, heading scale, whitespace rhythm (`DES-HIER`, `DES-TYPO`).
2. **Tokens second**: Define color palette, spacing scale, and type scale as design tokens before building components (`DES-COLR`, `DES-SPAC`, `DES-CONS`).
3. **States third**: Design every UI state (loading, empty, error, success, disabled) for each component (`DES-STAT`).
4. **Accessibility fourth**: Verify contrast ratios, keyboard flow, ARIA labels, and touch targets meet the AA floor (`DES-A11Y`, `DES-RESP`).
5. **Polish last**: Apply animation, icon refinement, and brand personality only after the structural foundation is solid (`DES-ICON`, `DES-BRND`).
