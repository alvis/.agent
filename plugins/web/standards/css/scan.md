# CSS Color-Mode: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

Any single violation blocks submission by default.
If a violation is detected, load the matching rule guide at `./rules/<rule-id>.md` to confirm the violation and follow its fix guidance.

## Quick Scan

### Selector Contract

- DO NOT use `.dark` class selectors for dark mode (`html.dark`, `body.dark`, `.dark &`) — the contract is `:root[data-theme="dark"]` [`CSS-MODE-01`]
- DO NOT use alternate attribute names such as `data-mode`, `data-color-scheme`, `data-color-mode`, or `data-appearance` for color modes — only `data-theme` [`CSS-MODE-01`]
- DO NOT mix `data-theme` (brand) with `data-theme` (color mode) on the same attribute — brand is `data-brand`, color mode is `data-theme` [`CSS-MODE-01`]

### System Mode

- DO NOT read `window.matchMedia('(prefers-color-scheme: dark)')` to apply a class on `<html>` — system mode MUST resolve via `:root:not([data-theme])` in CSS [`CSS-MODE-02`]
- DO NOT default `data-theme="light"` on `<html>` at boot — absence of the attribute IS system mode; presence is an explicit override [`CSS-MODE-02`]
- DO NOT wrap dark styles in `@media (prefers-color-scheme: dark)` without the `:root:not([data-theme])` qualifier — that breaks explicit overrides [`CSS-MODE-02`]

### Layer & `color-scheme`

- DO NOT declare color-mode tokens outside `@layer theme` (e.g. at unlayered `:root`, inside `@layer base`, or inside `@layer components`) [`CSS-MODE-03`]
- DO NOT omit `color-scheme: light|dark` in any mode branch — native form controls, scrollbars, and `<input type="date">` pickers MUST inherit the mode [`CSS-MODE-03`]
- DO NOT set `color-scheme` only on `html` outside the layered theme block — it MUST live inside the same `@layer theme` mode branch as the tokens it accompanies [`CSS-MODE-03`]

### Two-Tier Tokens

- DO NOT reference tier-1 raw mode tokens (`--theme-light-bg`, `--theme-dark-fg`, etc.) from component CSS — styled declarations use component override → active tier-2 UI token → literal fallback [`CSS-MODE-04`]
- DO NOT skip the tier-2 alias and consume tier-1 raw tokens directly inside a `[data-theme]` branch [`CSS-MODE-04`]
- DO NOT inline mode-conditional values inside component selectors (e.g. `.card { background: #fff; } [data-theme="dark"] .card { background: #000; }`) — the alias lives in `@layer theme`, not on components [`CSS-MODE-04`]

## Rule Matrix

| Rule ID | Violation | Bad Examples |
|---|---|---|
| `CSS-MODE-01` | Wrong selector contract for color mode | `html.dark { … }`; `:root[data-mode="dark"] { … }`; `[data-color-scheme="dark"] { … }` |
| `CSS-MODE-02` | JS-driven or attribute-defaulted system detection | `document.documentElement.classList.toggle('dark', mql.matches)`; `<html data-theme="light">` shipped as the default |
| `CSS-MODE-03` | Color-mode tokens outside `@layer theme` or missing `color-scheme` | `:root { --ui-bg: #fff; }` at top level (unlayered); `:root[data-theme="dark"] { --ui-bg: #000; }` without `color-scheme: dark` |
| `CSS-MODE-04` | Components read raw tier-1 tokens or inline mode conditionals | `.card { background: var(--theme-dark-bg); }`; `[data-theme="dark"] .card { background: #000; }` instead of `.card { background: var(--card-bg, var(--ui-bg, #ffffff)); }` |
