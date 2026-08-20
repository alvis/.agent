# Design: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

Any P0 or P1 finding blocks UI approval and completion unless it is closed
under the canonical
[audit disposition contract](../../skills/audit/references/review-template.md).
A non-fixed closure requires explicit risk-acceptance authority, an accountable
owner, non-placeholder rationale, durable acceptance evidence, and a concrete
recheck condition.
If a violation is detected, load the matching rule guide at `./rules/<rule-id>.md` to confirm the violation and follow its fix guidance.

> **During auditing**: Report all findings with severity. For the design skill, self-audit against this checklist and iterate toward 10/10 in every category, within that skill's rework budget — carry whatever still falls short to confirmation as a residual gap rather than looping past the budget. For the audit skill, report violations without fixing them.

## Quick Scan

### Visual Hierarchy & Layout

- DO NOT create flat hierarchy where everything looks equally important — primary/secondary/tertiary levels must be visually distinct [`DES-HIER-01`]
- DO NOT make CTA buttons that blend with surrounding elements — primary CTA must be identifiable in <3 seconds [`DES-HIER-02`]

### Typography

- DO NOT use more than 2-3 typefaces without a systematic scale [`DES-TYPO-01`]
- DO NOT use body text <14px on mobile, line-height <1.4, or line lengths >75ch [`DES-TYPO-02`]

### Color & Contrast

- DO NOT use >12 unique non-neutral colors or undisciplined palettes without primary/accent/neutral/semantic slots [`DES-COLR-01`]
- DO NOT fail WCAG AA contrast: 4.5:1 normal text, 3:1 large text/UI components [`DES-COLR-02`]

### Spacing & Grid

- DO NOT use spacing values off the 4px/8px grid (e.g., 5px, 7px, 13px) [`DES-SPAC-01`]
- DO NOT place related items with the same spacing as unrelated groups — proximity must convey relationships [`DES-SPAC-02`]

### Consistency & Tokens

- DO NOT hardcode color/spacing/radius values when design tokens (CSS custom properties) exist [`DES-CONS-01`]
- DO NOT use different styles for the same component purpose across screens [`DES-CONS-02`]

### Accessibility

- DO NOT remove focus indicators (`outline: none`) without a `:focus-visible` replacement [`DES-A11Y-01`]
- DO NOT omit ARIA labels on icon-only buttons, form labels on inputs, or use touch targets <44px [`DES-A11Y-02`]

### States & Feedback

- DO NOT omit loading (skeleton), empty (guidance), error (recovery), success (next step), or permission states [`DES-STAT-01`]
- DO NOT leave interactive elements without hover, active, disabled, and focus visual states [`DES-STAT-02`]

### Navigation & IA

- DO NOT organize navigation by backend/technical structure instead of user mental model [`DES-NAVI-01`]
- DO NOT omit current-location indication (breadcrumbs, active nav highlight) in navigation [`DES-NAVI-02`]
- DO NOT render the current page as a clickable link in nav/hamburger; must be visually distinct AND non-navigable [`DES-NAVI-03`]

### Content & Microcopy

- DO NOT use vague button labels ("Submit", "OK", "Done") — use concise verb-first action labels [`DES-COPY-01`]
- DO NOT show error messages without problem + cause + solution structure [`DES-COPY-02`]

### Responsiveness

- DO NOT allow horizontal scroll or fixed-width elements that break mobile layouts at 320-1440+ [`DES-RESP-01`]
- DO NOT use touch targets <44px on mobile or ignore thumb-zone placement for primary actions [`DES-RESP-02`]

### Imagery, Icons & Motion

- DO NOT mix icon styles (outline/filled/emoji) or use emoji as UI icons — single icon family enforced [`DES-ICON-01`]
- DO NOT add decorative animation that causes layout shifts or has no `prefers-reduced-motion` fallback [`DES-ICON-02`]

### Branding & Modern Standards

- DO NOT produce generic template-like designs with no visible brand personality [`DES-BRND-01`]
- DO NOT implement dark patterns (confirmshaming, pre-checked opt-outs, hidden costs, trick questions) [`DES-BRND-02`]

## Rule Matrix

| Rule ID | Violation | Bad Examples |
|---|---|---|
| `DES-HIER-01` | Flat hierarchy, no visual weight differentiation | All headings same size; all buttons same color/weight |
| `DES-HIER-02` | CTA not identifiable within 3 seconds | Primary button same style as secondary; no dominant action |
| `DES-TYPO-01` | Too many typefaces or no type scale | 4+ font families; random font sizes with no ratio |
| `DES-TYPO-02` | Body text unreadable | 12px body on mobile; 100ch line width; 1.0 line-height |
| `DES-COLR-01` | Color palette undisciplined | 15+ accent colors competing; no semantic color system |
| `DES-COLR-02` | WCAG AA contrast failure | 2.5:1 ratio on body text; light gray on white |
| `DES-SPAC-01` | Arbitrary spacing values not on grid | 5px here, 7px there, 13px elsewhere |
| `DES-SPAC-02` | Proximity principle violated | Related items have same gap as unrelated sections |
| `DES-CONS-01` | Hardcoded values instead of tokens | `#3b82f6` instead of `var(--primary)`; `8px` instead of `var(--space-2)` |
| `DES-CONS-02` | Inconsistent component styling | 3 different button styles for same action type across screens |
| `DES-A11Y-01` | Missing keyboard/focus support | `outline: none` without `:focus-visible`; custom controls not keyboard-accessible |
| `DES-A11Y-02` | Missing accessible names/labels | Icon button without `aria-label`; input with placeholder-only label |
| `DES-STAT-01` | Missing UI states | Blank screen while loading; empty area with no explanation |
| `DES-STAT-02` | Missing interactive states | No hover/disabled visual feedback on buttons; no active state |
| `DES-NAVI-01` | Technical IA structure | Nav matches database tables, not user tasks or goals |
| `DES-NAVI-02` | Lost navigation context | No breadcrumbs; no active indicator in sidebar/tabs |
| `DES-NAVI-03` | Current page still a link | Nav item for active route has `<a href>` that reloads; no `aria-current` |
| `DES-COPY-01` | Vague action labels | "Submit", "OK", "Click here", "Done" |
| `DES-COPY-02` | Unhelpful error messages | "Something went wrong"; error code with no guidance |
| `DES-RESP-01` | Broken mobile layout | Fixed-width tables; horizontal scroll on phone; content overflow |
| `DES-RESP-02` | Tiny mobile targets | 24px touch targets; primary actions outside thumb zone |
| `DES-ICON-01` | Mixed icon styles or emoji in UI | Outlined + filled + emoji mixed; icon-only for non-universal actions |
| `DES-ICON-02` | Decorative/disruptive animation | Bouncy effects; layout jumps during transitions; no reduced-motion |
| `DES-BRND-01` | Generic/template appearance | Default Bootstrap look; no brand colors; stock typography |
| `DES-BRND-02` | Dark patterns present | Confirmshaming; pre-checked marketing consent; hidden cancellation |
