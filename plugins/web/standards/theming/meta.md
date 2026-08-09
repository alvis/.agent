# Web Theming Standards

_Standards for client-owned theming: how shared web/component libraries expose a CSS-variable contract and how client apps override it without forking._

## Dependent Standards

🚨 **[IMPORTANT]** You MUST also read the following standards together with this file

- React Component Standards (plugin:react:standard:components) - Variant prop typing follows component prop rules; specifically `RC-PROPS-01` (flat, union-literal variants) and `RC-STRUCT-04` (element-prop inheritance)
- React Project Structure Standards (plugin:react:standard:project-structure) - Where shared theming files live within a workspace package follows the `RPS-WS-*` placement rules
- CSS Standards (plugin:web:standard:css) - Color-mode handling via `data-theme` follows the `CSS-MODE-*` rules; brand theming composes on top
- Naming Standards (plugin:coding:standard:naming) - Token names, scope class names, and `data-brand` values follow naming conventions
- TypeScript Standards (plugin:coding:standard:typescript) - Variant unions and theme-aware prop types use strict TypeScript typing throughout

**Note**: This standard requires the coding plugin to be enabled for referenced coding standards.

> 🎨 **`data-brand` vs `data-theme`** — `data-brand` carries brand identity (`acme`, `globex`); `data-theme` is reserved for color mode (`light`, `dark`; absent = system) per `CSS-MODE-*` in `plugin:web:standard:css`. They compose: `<html data-brand="acme" data-theme="dark">` selects the Acme brand in dark mode. Brand-scoped overrides in this standard use `[data-brand="…"]`, never `[data-theme="…"]`.

## Core Principles

### Library = Clay, Client = Sculpture

The shared library ships a base CSS-variable contract with safe hardcoded fallbacks. It does NOT ship a finished brand. Client applications own the final theme by overriding documented variables under a `[data-brand="…"]` scope. The library compiles and renders correctly even when no client theme is loaded — the fallbacks guarantee it.

```css
/* ✅ GOOD: library declares the contract with a safe default */
.ui-button {
  background: var(--button-primary-bg, var(--color-brand, #111827));
}

/* ❌ BAD: library hardcodes a brand color with no escape hatch */
.ui-button {
  background: #ff6600;
}
```

### Three-Tier Fallback Chain

Every component-level style resolves through `var(--component-specific, var(--semantic-token, hardcoded-default))`. The component token is the most specific override knob, the semantic token is the brand-wide palette, and the hardcoded default keeps the library shippable in isolation. A missing client theme MUST NEVER produce a broken UI.

```css
/* ✅ GOOD: three-tier resolution */
background: var(--button-primary-bg, var(--color-brand, #111827));

/* ❌ BAD: no semantic fallback, no hardcoded default */
background: var(--button-primary-bg);
```

### Variants and Token Names Are Semantic Roles

Both variant unions AND CSS variable token names describe what something _means_ (`primary`, `secondary`, `ghost`, `danger`, `--color-ink-heading`, `--color-surface-base`, `--radius-card`), not what it _looks like_ (`blue`, `rounded`, `wide`, `--ink-0`, `--c-violet`, `--glass-bg`, `--radius-md`) or who it belongs to (`acme`, `client`). Visual differences are resolved through role-named CSS variables, not literal colors or positional indices baked into the contract.

For sizes and scales, reach for Tailwind utilities (`rounded-md`, `shadow-sm`, `text-lg`) for the default scale; mint a custom token ONLY when the value carries a role (`--radius-card`, `--shadow-elevated`, `--text-body`). NEVER mint `--radius-md`, `--shadow-sm`, `--text-body-lg` — those re-implement Tailwind's scale behind a redundant indirection. Color words MUST NOT appear in token names: the brand accent is `--color-accent`, never `--color-accent-violet`.

```typescript
// ✅ GOOD: semantic intent
type ButtonProps = { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' };

// ❌ BAD: visual / brand identity
type ButtonProps = { variant?: 'blue' | 'rounded' | 'acme' };
```

```css
/* ✅ GOOD: role-named tokens */
@theme {
  --color-ink-heading: #0a0a0a;
  --color-surface-base: #ffffff;
  --color-accent: #7c3aed;
  --radius-card: 0.75rem;
}

/* ❌ BAD: positional, color-leaf, or size-tier names */
:root {
  --ink-0: #0a0a0a;
  --bg-0: #ffffff;
  --color-accent-violet: #7c3aed;
  --radius-md: 0.5rem;
}
```

### Brand Scoping Lives on `[data-brand]`, Not Props

Switching brands is a DOM-scope concern, not a component-prop concern. Client apps set `<html data-brand="acme">` (or any ancestor) and brand overrides cascade naturally. Components NEVER accept a `brand="…"` or `client="…"` prop. (Color mode rides alongside on `data-theme`; see the callout above.)

```html
<!-- ✅ GOOD: brand is a DOM scope -->
<html data-brand="acme" data-theme="dark">
  <Button variant="primary" />
</html>

<!-- ❌ BAD: brand leaks into the component API -->
<Button variant="primary" brand="acme" />
```

## Rule Groups

- `WT-CONTRACT-*`: CSS variable contract — three-tier fallback chain, separation of semantic vs component tokens.
  - `WT-CONTRACT-01`: CSS Variable Contract with Three-Tier Fallback
  - `WT-CONTRACT-02`: Semantic Tokens Go in `@theme`, Component Tokens Go in Plain CSS
- `WT-VARIANT-*`: Variant prop API and CSS token names — semantic role naming, CSS-variable resolution.
  - `WT-VARIANT-01`: Variants and Token Names Express Semantic Role, Never Appearance or Size
  - `WT-VARIANT-02`: Variant Visuals Resolve Through CSS Variables
- `WT-TAILWIND-*`: Tailwind v4.3 integration — `@theme` ownership, import order.
  - `WT-TAILWIND-01`: Tailwind v4.3 `@theme` Block Owns the Semantic Token Contract
  - `WT-TAILWIND-02`: CSS Import Order Is Fixed
- `WT-OVERRIDE-*`: Client override strategy — scoped variables, slots, primitives, wrappers.
  - `WT-OVERRIDE-01`: Override via Scoped CSS Variables, Not Forks or Branded Props
  - `WT-OVERRIDE-02`: Use Slots / Primitives When Variables Aren't Enough

## What's Stricter Here

This standard enforces requirements beyond typical Tailwind / CSS-in-JS conventions:

| Standard Practice                                                          | Our Stricter Requirement                                                                                          |
|----------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| Library ships a finished theme with brand colors                           | **Library ships a CSS-variable contract with safe defaults; client owns the theme**                               |
| `var(--token)` with no fallback                                            | **Three-tier fallback: `var(--component, var(--semantic, hardcoded))`**                                           |
| Brand or visual variants (`blue`, `rounded`, `acme`)                       | **Variants are semantic intent only (`primary`, `secondary`, `ghost`, `danger`)**                                  |
| CSS variables named by position or color (`--ink-0`, `--c-violet`, `--color-accent-violet`) | **CSS variables named by role (`--color-ink-heading`, `--color-accent`); positional indices and color words anywhere in the name are forbidden** |
| Mint size-tier tokens that re-implement Tailwind's scale (`--radius-md`, `--shadow-sm`, `--text-body-lg`) | **Use Tailwind utilities for default sizes (`rounded-md`, `shadow-sm`, `text-lg`); mint custom tokens only when they carry a role (`--radius-card`, `--shadow-elevated`)** |
| Brand switched via React prop or context                                   | **Brand switched via `[data-brand="…"]` DOM scope, never a component prop**                                       |
| Mix semantic and component tokens in `@theme`                              | **`@theme` holds semantic tokens only (utility-class generators); component tokens are plain CSS variables**       |
| Free-form CSS import order                                                 | **Library stylesheet FIRST, then client `theme.css`, then app CSS — fixed and enforced**                          |
| Fork a component to re-skin it                                             | **Override CSS variables under a scope class; only fork via slots, primitives, or client-owned wrappers**         |
| Add `client="acme"` or `isMarketingHero` props for one-offs                | **One-offs use scoped CSS variables (`.checkout-flow { --button-primary-bg: … }`); branded props are forbidden** |

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
