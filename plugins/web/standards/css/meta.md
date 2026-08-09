# CSS Color-Mode Standards

_Standards for the light / dark / system color-mode contract: a CSS-only, two-tier token chain driven by `@layer theme`, `:root[data-theme]`, and `prefers-color-scheme`._

## Dependent Standards

You MUST also read the following standards together with this file:

- React Theming Standards (standard:theming) — `@theme` (Tailwind v4.3) owns the brand semantic palette; this standard owns the raw per-mode palette and the active UI tokens. They compose at selectors like `:root[data-brand="acme"][data-theme="dark"]`.
- Design Standards (standard:design) — color and contrast rules (`DES-COLR-*`) apply to both modes; both light and dark palettes MUST meet WCAG AA contrast.
- Naming Standards (plugin:coding:standard:naming) — token names (`--theme-{mode}-{role}`, `--ui-{role}`) and `data-theme` values follow naming conventions.

**Note**: This standard requires the coding plugin to be enabled for referenced coding standards.

## Core Principles

### CSS-Only, No JS Required

Color-mode resolution happens entirely in CSS. The browser picks the right cascade branch from `prefers-color-scheme` when no explicit override is set, and from `:root[data-theme="…"]` when one is. No client-side JavaScript is required to render the correct mode on first paint — eliminating the flash-of-wrong-theme (FOWT) class of bugs.

### System Mode = Absence of `data-theme`

System mode is not a value — it is the absence of an explicit override. A `:root` element without a `data-theme` attribute defers to `@media (prefers-color-scheme: light|dark)`. Setting `data-theme="light"` or `data-theme="dark"` is an explicit override that wins regardless of OS preference.

### Two-Tier Token Chain

Tier 1 is the raw per-mode palette (`--theme-light-bg`, `--theme-dark-bg`, …). Tier 2 is the active UI semantic token (`--ui-bg`, `--ui-fg`, …) that aliases the active tier-1 value inside every mode branch. Components consume **only** tier-2 tokens; they never reach past the alias to a raw mode token.

## Rule Groups

- `CSS-MODE-01`: Selector contract — `:root[data-theme="light"|"dark"]` for explicit overrides; `.dark` class and `data-mode` / `data-color-scheme` variants are forbidden.
- `CSS-MODE-02`: System mode resolution — `:root:not([data-theme])` + `prefers-color-scheme` media queries; no JS detection.
- `CSS-MODE-03`: Layer placement and `color-scheme` — color-mode tokens MUST live inside `@layer theme`, and each mode branch MUST set `color-scheme: light|dark` for native UA controls.
- `CSS-MODE-04`: Two-tier token chain — raw mode tokens (tier 1) feed active UI tokens (tier 2); components consume only tier-2 active tokens.

## What's Stricter Here

This standard enforces requirements beyond common dark-mode practice:

| Standard Practice                                              | Our Stricter Requirement                                                                                              |
|----------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| Tailwind `darkMode: 'class'` toggling `.dark` on `<html>`      | **`:root[data-theme="light"|"dark"]` attribute selectors only; no `.dark`, no `data-mode`, no `data-color-scheme`**   |
| JS reads `localStorage`, then adds a class on hydration        | **CSS-only resolution via `prefers-color-scheme` + `:root:not([data-theme])`; no flash-of-wrong-theme**               |
| Single-tier tokens (`--bg-light`, `--bg-dark` consumed directly) | **Two-tier chain: tier-1 raw palette feeds tier-2 active UI tokens; components consume only tier-2**                  |
| Color-mode declarations scattered across cascade               | **All color-mode tokens live inside `@layer theme` so brand layers and app overrides can win predictably**            |
| `color-scheme` omitted, native controls stay light             | **Every mode branch sets `color-scheme: light|dark` so form controls, scrollbars, and date pickers theme correctly** |
| System mode emulated by reading `matchMedia` in JS             | **System mode = absence of `data-theme`; `:root:not([data-theme])` + `@media (prefers-color-scheme)` resolve it**     |

## Exception Policy

Allowed exceptions only when:

- False positive
- No viable workaround exists now

Required exception note fields:

- `rule_id`
- `reason` (`false_positive` or `no_workaround`)
- `evidence`
- `temporary_mitigation`
- `follow_up_action`

If exception note is missing, submission is rejected.
