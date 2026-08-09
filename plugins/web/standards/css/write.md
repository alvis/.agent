# CSS Color-Mode: Compliant Code Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.
> **Compliance**: Also follow `scan.md` in this directory to avoid violations during writing. When unsure about a specific rule, consult its detailed guidance in `rules/<rule-id>.md`.

## Key Principles

- Color modes resolve in CSS alone — no JavaScript, no flash-of-wrong-theme on first paint.
- `:root[data-theme="light"|"dark"]` is the only color-mode selector; `data-brand` is a separate, orthogonal axis.
- System mode is the absence of `data-theme`; `:root:not([data-theme])` + `@media (prefers-color-scheme: …)` resolves it.
- All color-mode tokens and their `color-scheme` declarations live inside `@layer theme`.
- Two tiers: tier-1 raw per-mode palette feeds tier-2 active UI tokens; components consume only tier-2.

## Core Rules Summary

### Color-Mode Contract (CSS-MODE)

- **CSS-MODE-01**: Use `:root[data-theme="light"]` and `:root[data-theme="dark"]` for explicit color-mode overrides; the brand attribute is `data-brand`; `.dark` class and `data-mode` / `data-color-scheme` are forbidden.
- **CSS-MODE-02**: Resolve system mode via `:root:not([data-theme])` + `@media (prefers-color-scheme: light|dark)`; absence of `data-theme` IS system mode and requires no JS.
- **CSS-MODE-03**: Place all color-mode tokens inside `@layer theme`; every mode branch sets `color-scheme: light|dark` so native UA controls theme correctly.
- **CSS-MODE-04**: Maintain a two-tier token chain — tier-1 raw mode tokens (`--theme-light-bg`) feed tier-2 active UI tokens (`--ui-bg`); components consume only tier-2.

## Patterns

### Canonical Color-Mode Block

This is the reference contract. Every project's color-mode foundation MUST follow this shape — selectors, layer, `color-scheme`, and two-tier resolution included.

```css
@layer theme {
  :root {
    --theme-light-bg: #ffffff;
    --theme-light-fg: #18181b;

    --theme-dark-bg: #09090b;
    --theme-dark-fg: #fafafa;

    color-scheme: light;

    --ui-bg: var(--theme-light-bg);
    --ui-fg: var(--theme-light-fg);
  }

  @media (prefers-color-scheme: light) {
    :root:not([data-theme]) {
      color-scheme: light;

      --ui-bg: var(--theme-light-bg);
      --ui-fg: var(--theme-light-fg);
    }
  }

  :root[data-theme="light"] {
    color-scheme: light;

    --ui-bg: var(--theme-light-bg);
    --ui-fg: var(--theme-light-fg);
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme]) {
      color-scheme: dark;

      --ui-bg: var(--theme-dark-bg);
      --ui-fg: var(--theme-dark-fg);
    }
  }

  :root[data-theme="dark"] {
    color-scheme: dark;

    --ui-bg: var(--theme-dark-bg);
    --ui-fg: var(--theme-dark-fg);
  }
}
```

Read the cascade as four branches: the `:root` baseline (light fallback for non-supporting UAs), then for each of `light` and `dark` a system branch (`:root:not([data-theme])` inside `@media (prefers-color-scheme: …)`) and an explicit branch (`:root[data-theme="…"]`). Every branch redeclares both `color-scheme` and the tier-2 aliases so the active mode is fully resolved at the `:root` level.

### Extending With More Semantic Tokens

Add new semantic UI tokens by extending **both** tiers symmetrically. Tier 1 gains raw per-mode palette entries; every mode branch in `@layer theme` aliases those into tier 2. Components keep consuming tier-2 names only.

```css
@layer theme {
  :root {
    /* tier 1: raw palette additions */
    --theme-light-border: #e4e4e7;
    --theme-light-muted: #71717a;

    --theme-dark-border: #27272a;
    --theme-dark-muted: #a1a1aa;

    /* tier 2: active aliases (light default) */
    --ui-border: var(--theme-light-border);
    --ui-muted: var(--theme-light-muted);
  }

  :root[data-theme="dark"] {
    --ui-border: var(--theme-dark-border);
    --ui-muted: var(--theme-dark-muted);
  }

  /* …repeat for system + light branches symmetrically… */
}

.card {
  background: var(--ui-bg);
  color: var(--ui-fg);
  border: 1px solid var(--ui-border); /* tier-2 only */
}
```

### Composing With Brand Themes

Brand and color mode are **independent axes**. The brand layer (`@theme` from Tailwind v4.3, per `plugin:web:standard:theming`) owns the brand semantic palette (`--color-accent`, `--color-ink-heading`, …). This standard's `@layer theme` owns the raw mode palette and the active UI tokens. They compose at compound selectors:

| Axis | Attribute | Owner | Standard |
|---|---|---|---|
| Brand identity | `data-brand="acme"` | `@theme` semantic tokens | `plugin:web:standard:theming` |
| Color mode | `data-theme="light|dark"` | `@layer theme` raw + active UI tokens | This standard (`CSS-MODE-*`) |

```css
@layer theme {
  /* default acme + dark composition */
  :root[data-brand="acme"][data-theme="dark"] {
    --ui-bg: var(--theme-dark-bg);
    --ui-fg: var(--theme-dark-fg);
    --ui-accent: var(--color-accent); /* brand layer feeds in here */
  }
}
```

A component never branches on brand or mode — it consumes `var(--ui-bg)` and lets the cascade decide.

## Anti-Patterns

- `<html class="dark">` toggled by JavaScript on hydration — flashes the wrong theme on first paint and breaks server rendering.
- Defaulting `<html data-theme="light">` at boot — erases system mode and forces a manual reset to follow OS preference.
- A `@media (prefers-color-scheme: dark)` block without `:root:not([data-theme])` — overrides explicit user choice every time.
- Color-mode tokens declared at an unlayered `:root` or inside `@layer base` — app overrides cannot win predictably across the cascade.
- Components reading `var(--theme-dark-bg)` directly — bypasses the alias and breaks the moment the mode changes.
- Inline mode conditionals on components (`[data-theme="dark"] .card { background: #000 }`) — duplicates the contract and scatters mode logic across files.
- Omitting `color-scheme` — leaves native scrollbars, form controls, and date pickers stuck in light mode.

## Quick Decision Tree

1. **Adding a new color-mode token?** Add tier-1 raw entries for every mode, then alias into tier-2 inside every mode branch (`CSS-MODE-04`).
2. **Need to style a component for dark mode?** Don't. Style it once with `var(--ui-*)` tokens; the cascade resolves the mode (`CSS-MODE-04`).
3. **Toggling theme from a settings panel?** Set `<html data-theme="dark">`; remove the attribute to return to system (`CSS-MODE-01`, `CSS-MODE-02`).
4. **Native control (scrollbar, date picker) looks wrong?** Verify `color-scheme` is set inside every mode branch in `@layer theme` (`CSS-MODE-03`).
5. **Adding a brand variant?** Use a separate `data-brand` attribute; compose at `:root[data-brand="…"][data-theme="…"]` — never repurpose `data-theme` for brand (`CSS-MODE-01`).
