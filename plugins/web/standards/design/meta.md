# Design Standards

_Compact rules for visual hierarchy, typography, color, spacing, consistency, accessibility, states, navigation, content, responsiveness, iconography, and branding._

## Dependent Standards

None — this is the web plugin's foundational design standard.

## What's Stricter Here

This standard enforces requirements beyond common design practices:

| Standard Practice                          | Our Stricter Requirement                                                  |
|--------------------------------------------|---------------------------------------------------------------------------|
| Visual appeal is subjective                | **Measurable framework: hierarchy levels, scan patterns, CRAP principles** |
| Typography choices are flexible            | **Max 2–3 typefaces, enforced type scale, line-height/line-length ranges** |
| Contrast "looks fine"                      | **WCAG AA floor: 4.5:1 normal text, 3:1 large text and UI components**   |
| Spacing is eyeballed                       | **4px/8px base grid; all spacing values must land on grid**               |
| Hardcoded values are common                | **Design tokens (CSS variables) required; hardcoded values flagged**      |
| Accessibility is a nice-to-have            | **WCAG AA floor: keyboard nav, focus indicators, ARIA, touch targets**   |
| Some states can be skipped                 | **All 5 required: loading, empty, error, success, permission**           |
| Navigation structure varies                | **Organized by user mental model; ≤7 top-level items; location indicated** |
| Button labels like "OK" / "Submit" are fine | **Action-verb labels; layered help text; error = problem + cause + fix** |
| Desktop-first is acceptable                | **Responsive at 320/768/1024/1440+; no horizontal scroll on mobile**     |
| Mixed icon styles are tolerated            | **Single icon family; no emoji as UI icons; motion explains, not decorates** |
| Brand is optional polish                   | **Brand personality required; no dark patterns; ethical defaults**        |

## Exception Policy

Allowed exceptions only when:

- False positive
- No viable workaround exists now
- Brand deviation required by client brand guidelines

Required exception note fields:

- `rule_id`
- `reason` (`false_positive`, `no_workaround`, or `brand_deviation`)
- `evidence`
- `temporary_mitigation`
- `follow_up_action`

If exception note is missing, submission is rejected.

## Rule Groups

- `DES-HIER-*`: Visual hierarchy and layout — clear importance levels, scan patterns, CRAP principles, task-first identification.
- `DES-TYPO-*`: Typography — typeface limits, type scale, line-height, line-length, minimum mobile body size.
- `DES-COLR-*`: Color and contrast — intentional palette, WCAG AA contrast ratios, semantic color usage, no color-only indicators.
- `DES-SPAC-*`: Spacing and grid — 4px/8px base grid, consistent margins/padding, proximity-based grouping, alignment.
- `DES-CONS-*`: Consistency and design tokens — CSS variable adoption, component reuse, border-radius/shadow uniformity, naming consistency.
- `DES-A11Y-*`: Accessibility — keyboard navigation, visible focus indicators, ARIA labels, form labels, alt text, touch targets ≥44×44 CSS px.
- `DES-STAT-*`: States and feedback — loading, empty, error, success, and permission states; hover/active/disabled/focus on interactive elements.
- `DES-NAVI-*`: Navigation and IA — mental-model grouping, ≤7 top-level items, breadcrumbs, search/filter, current-location indication.
- `DES-COPY-*`: Content and microcopy — action-verb labels, help text layering (L0–L3), error message clarity, no jargon, consistent terminology.
- `DES-RESP-*`: Responsiveness — breakpoints at 320/768/1024/1440+, mobile touch targets, content reflow, no horizontal scroll.
- `DES-ICON-*`: Imagery, icons, and motion — single icon set, no emoji as icons, labeled ambiguous icons, purposeful animation, layout stability.
- `DES-BRND-*`: Branding and modern standards — brand personality expression, current design patterns, no dark patterns, ethical defaults, transparent data collection.
