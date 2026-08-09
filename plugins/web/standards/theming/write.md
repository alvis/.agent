# Web Theming: Compliant Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies and rule groups.
> **Compliance**: Also follow `scan.md` in this directory to avoid violations during writing. When unsure about a specific rule, consult its detailed guidance in `rules/<rule-id>.md`.

## Key Principles

- **Library = clay, client = sculpture** — the library publishes a base CSS-variable contract with safe fallbacks; the client owns the final theme.
- **Three-tier fallback chain** — every styled declaration resolves through `var(--component-specific, var(--semantic-token, hardcoded-default))`.
- **Variants are semantic intent** — `primary | secondary | ghost | danger`, never brand identity (`blue`, `acme`).
- **Brand is scoped via `[data-brand="…"]`** — never via a component prop. Color mode rides alongside on `data-theme` (`light` / `dark`; absent = system) per `CSS-MODE-*`.

## Core Rules Summary

| Rule              | One-liner                                                                                          |
|-------------------|----------------------------------------------------------------------------------------------------|
| `WT-CONTRACT-01`  | Every styled declaration uses `var(--component, var(--semantic, hardcoded))`.                       |
| `WT-CONTRACT-02`  | Semantic tokens go in `@theme`; component tokens go in plain CSS.                                   |
| `WT-VARIANT-01`   | Variants and CSS token names express semantic role (heading, base, accent, card), never appearance (blue, -0, soft) or size tier (-md, -sm). |
| `WT-VARIANT-02`   | Variant CSS classes resolve visuals through CSS variables, not literals.                            |
| `WT-TAILWIND-01`  | Library's `@theme { … }` owns the semantic token contract.                                          |
| `WT-TAILWIND-02`  | CSS import order is library → client `theme.css` → app CSS.                                         |
| `WT-OVERRIDE-01`  | Override via scoped CSS variables; no forks, no branded props.                                      |
| `WT-OVERRIDE-02`  | When variables aren't enough, use slots / primitives / wrappers — never mutate the shared component. |

## Library File Structure

```plaintext
packages/ui/
├── src/
│   ├── components/
│   │   ├── Button.tsx                # variant prop + CSS class mapping
│   │   ├── Button.css                # @layer components { .ui-button { … } }
│   │   ├── Button.stories.tsx
│   │   └── Card.tsx
│   ├── primitives/                   # headless behavior providers (Slot, VisuallyHidden, …)
│   │   └── Slot.tsx
│   └── styles/
│       ├── theme.css                 # @theme { … } — semantic token contract
│       └── components.css            # @layer components — imports all component CSS
└── dist/
    ├── styles.css                    # built bundle: theme + components
    └── base-theme.css                # OPTIONAL: a usable starter theme client apps may import
```

The library publishes `styles.css` (the contract + components) and optionally a `base-theme.css` that client apps can adopt verbatim or replace.

## Tailwind v4.3 `@theme {}` — Semantic Tokens

Tailwind v4.3's `@theme` block declares the tokens that generate utility classes. A token named `--color-brand` produces `bg-brand`, `text-brand`, `border-brand`. A token named `--radius-card` produces `rounded-card`. The library owns this contract; clients override the same names under a `[data-brand="…"]` scope.

```css
/* packages/ui/src/styles/theme.css */
@import "tailwindcss";

@theme {
  --color-brand: #111827;
  --color-surface: #ffffff;
  --color-text: #0a0a0a;
  --radius-card: 0.5rem;
  --shadow-card: 0 1px 2px rgb(0 0 0 / 0.06);
  --font-sans: "Inter", system-ui, sans-serif;
}
```

After this declaration, JSX can use `<div className="bg-brand text-surface rounded-card font-sans">…</div>` and every utility resolves through the same variable that clients override.

## Component-Level Tokens — Plain CSS Variables

Per-component tokens (`--button-primary-bg`, `--button-md-height`) MUST NOT live in `@theme` — they are not utility-class generators. They live in component CSS under `@layer components`, with the three-tier fallback chain pointing at the semantic token and a hardcoded default.

```css
/* packages/ui/src/components/Button.css */
@layer components {
  .ui-button {
    background: var(--button-primary-bg, var(--color-brand, #111827));
    border-radius: var(--button-radius, var(--radius-card, 0.5rem));
    height: var(--button-md-height, 2.5rem);
    color: var(--button-primary-fg, var(--color-surface, #ffffff));
    font-family: var(--font-sans, system-ui, sans-serif);
  }

  .ui-button--secondary {
    background: var(--button-secondary-bg, transparent);
    color: var(--button-secondary-fg, var(--color-text, #0a0a0a));
    border: 1px solid var(--button-secondary-border, var(--color-text, #0a0a0a));
  }

  .ui-button--sm { height: var(--button-sm-height, 2rem); }
  .ui-button--lg { height: var(--button-lg-height, 3rem); }
}
```

## Token Naming — Role, Not Appearance or Size

CSS token names follow the pattern `--<category>-<role>[-<modifier>]`. The role describes what the token MEANS in the UI; the value can change at re-skin time without renaming the contract. Positional indices (`-0`, `-1`), color words anywhere in the name (`-violet`, `-blue`), visual descriptors as the role (`--glass-bg`, `--line-soft`), and pure size-tier suffixes (`--radius-md`, `--shadow-sm`) are forbidden.

### Categories and Roles

| Category   | Pattern                       | Role Examples                                                        |
|------------|-------------------------------|----------------------------------------------------------------------|
| Color      | `--color-<role>`              | `ink-heading`, `ink-body`, `ink-muted`, `ink-subtle`                  |
|            |                               | `surface-base`, `surface-raised`, `surface-overlay`, `surface-glass` |
|            |                               | `border-subtle`, `border`, `border-strong`                            |
|            |                               | `accent`, `link`, `callout`                                           |
|            |                               | `pillar-ingest`, `pillar-memory`, `pillar-reflex`                     |
| Text       | `--text-<role>`               | `eyebrow`, `body`, `display-md`, `display-sm`                         |
| Tracking   | `--tracking-<role>`           | `eyebrow`, `body`                                                     |
| Radius     | `--radius-<role>`             | `card`, `button`, `modal`                                             |
| Shadow     | `--shadow-<role>`             | `elevated`, `overlay`                                                 |
| Spacing    | `--spacing-<role>`            | `gutter`, `section`, `inset`                                          |

### Side-by-Side: Bad → Good

| ❌ Visual / positional / size-tier         | ✅ Role-named                          | Why                                                   |
|--------------------------------------------|----------------------------------------|-------------------------------------------------------|
| `--ink-0`                                  | `--color-ink-heading`                  | "What does -0 mean?" → name the role                  |
| `--ink-1`                                  | `--color-ink-body`                     |                                                       |
| `--ink-2`                                  | `--color-ink-muted`                    |                                                       |
| `--ink-3`                                  | `--color-ink-subtle`                   |                                                       |
| `--bg-0`                                   | `--color-surface-base`                 | Surface depth is a role, not a number                 |
| `--bg-1`                                   | `--color-surface-raised`               |                                                       |
| `--bg-2`                                   | `--color-surface-overlay`              |                                                       |
| `--line-soft`                              | `--color-border-subtle`                | "Soft" is the look; "subtle" is the role              |
| `--line`                                   | `--color-border`                       |                                                       |
| `--line-strong`                            | `--color-border-strong`                |                                                       |
| `--c-violet`                               | `--color-accent`                       | Strip the color word entirely                         |
| `--color-accent-violet`                    | `--color-accent`                       | Color word MUST NOT appear in the name                |
| `--c-ingest`                               | `--color-pillar-ingest`                | `ingest` is a product-domain role                     |
| `--glass-bg`                               | `--color-surface-glass`                | Glass is a surface role                               |
| `--glass-bg-strong`                        | `--color-surface-glass-strong`         |                                                       |
| `--radius-md`                              | use `rounded-md` (Tailwind utility)    | Don't re-implement Tailwind's scale                   |
| `--shadow-sm`                              | use `shadow-sm` (Tailwind utility)     |                                                       |
| `--text-body-lg`                           | use `text-lg` (Tailwind utility)       |                                                       |
| `--card-radius-md`                         | `--radius-card`                        | Mint role-named tokens for non-default sizes          |

### Sizes & Scales

Reach for Tailwind utilities first. Use `rounded-md`, `shadow-sm`, `text-lg` directly in JSX/CSS for the default scale — these utilities resolve through Tailwind's own scale and don't need a custom token.

Mint a custom token ONLY when the value carries a role:

```css
/* ✅ GOOD: role-named size tokens — value diverges from Tailwind's default */
@theme {
  --radius-card: 0.75rem;
  --radius-button: 0.5rem;
  --radius-modal: 1rem;
  --shadow-elevated: 0 10px 30px rgb(0 0 0 / 0.12);
  --text-body: 0.9375rem;     /* divergent body size */
}

/* ❌ BAD: re-implements Tailwind's scale behind a redundant indirection */
@theme {
  --radius-md: 0.5rem;
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.06);
  --text-body-lg: 1.125rem;
}
```

If a button needs a radius one notch larger than `rounded-md`, mint `--radius-button` — NOT `--radius-md-plus` or `--radius-2`. The role is "button's radius", not "medium plus a bit".

### Tier-as-Role Exception (Narrow)

`--text-display-md`, `--text-display-sm`, `--text-display-lg` are allowed ONLY when Tailwind has no equivalent size variant for that role. `display` is the role; Tailwind ships no `display` typographic tier, so `md`/`sm` are tier variants WITHIN the role. Once Tailwind adds the equivalent, the custom token MUST go away. This exception does NOT cover `--text-body-lg` because `text-lg` already exists.

## Client `theme.css` — Overriding Tokens

A client app overrides the semantic tokens (preferred, broad reach) and/or component tokens (narrow, targeted) under a `[data-brand="…"]` selector. Setting `<html data-brand="acme">` activates the theme for the entire tree.

```css
/* apps/acme/src/theme.css */
[data-brand="acme"] {
  /* semantic-tier overrides — affects every component using --color-brand */
  --color-brand: #ff6600;
  --color-surface: #fffaf5;
  --radius-card: 999px;
  --font-sans: "Acme Display", system-ui, sans-serif;

  /* component-tier overrides — only the buttons */
  --button-primary-bg: #ff6600;
  --button-radius: 999px;
}
```

Semantic overrides are the default tool. Drop to component overrides only when one component needs to diverge from the broader palette.

### Composing brand with color mode

Brand identity (`data-brand`) and color mode (`data-theme`) compose at the selector level. The library's `@theme` block carries the brand-wide semantic palette; the `@layer theme` rules from `CSS-MODE-*` (see `plugin:web:standard:css`) carry the raw-mode tokens (`--theme-dark-bg`, …) plus the active-UI aliases (`--ui-bg`, …). A brand override scoped to a color mode chains both attributes:

```css
:root[data-brand="acme"][data-theme="dark"] {
  --color-accent: #ff6600;
  --ui-bg: var(--theme-dark-bg);
}
```

The brand selector reaches for raw-mode tokens via `var(--theme-dark-bg)` so the active-UI tokens still resolve through the mode layer — brand owns the semantic palette, color mode owns the surface/ink layer, and the cascade composes them without either side hardcoding the other's values.

## CSS Import Order

```typescript
// apps/acme/src/app.tsx
import '@company/ui/styles.css';   // 1. library — declares @theme + component contract
import './theme.css';              // 2. client theme — overrides under [data-brand="acme"]
import './app.css';                // 3. app-level CSS — page layouts, route-specific styles
```

Reversing this order breaks the cascade: client overrides arrive before the contract they're meant to override, so they have nothing to override. This is `WT-TAILWIND-02`.

## Variant Prop API

Components expose semantic variant unions only. Use `variant` for visual intent, `size` for sizing, and inherit element props via `ComponentPropsWithoutRef` (see `RC-STRUCT-04`). Variant unions are flat, simple, and semantic (see `RC-PROPS-01`).

```typescript
// packages/ui/src/components/Button.tsx
import { type ComponentPropsWithoutRef, type FC, type PropsWithChildren } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import './Button.css';

const button = cva('ui-button', {
  variants: {
    variant: {
      primary: 'ui-button--primary',
      secondary: 'ui-button--secondary',
      ghost: 'ui-button--ghost',
      danger: 'ui-button--danger',
    },
    size: {
      sm: 'ui-button--sm',
      md: 'ui-button--md',
      lg: 'ui-button--lg',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

export type ButtonProps = PropsWithChildren<ComponentPropsWithoutRef<'button'>> &
  VariantProps<typeof button>;

export const Button: FC<ButtonProps> = ({ variant, size, className, ...props }) => (
  <button className={button({ variant, size, className })} {...props} />
);
```

`cva` is canonical here, not mandated — any consistent class-mapping approach is acceptable as long as the variant union remains semantic and the CSS class resolves visuals through variables.

### Forbidden Variant Shapes

```typescript
// ❌ BAD: visual / brand identity in the variant union
type ButtonProps = { variant?: 'blue' | 'rounded' | 'wide' };

// ❌ BAD: brand baked into a prop
type ButtonProps = { client?: 'acme' | 'globex' };

// ❌ BAD: brand switched via prop instead of [data-brand]
type ButtonProps = { brand?: 'acme' | 'globex' };
```

## Scoped Local Override Pattern

When a single feature needs one-off variation without forking the component, declare a scope class that overrides the component's CSS variables locally:

```css
/* apps/acme/src/features/checkout/CheckoutFlow.css */
.checkout-flow {
  --button-primary-bg: #2563eb;
  --button-radius: 0.25rem;
}
```

```tsx
// apps/acme/src/features/checkout/CheckoutFlow.tsx
export const CheckoutFlow: FC<PropsWithChildren> = ({ children }) => (
  <section className="checkout-flow">
    <Button variant="primary">Pay now</Button>
    {children}
  </section>
);
```

Any `<Button variant="primary">` rendered inside `.checkout-flow` now resolves to the scoped values. This is `WT-OVERRIDE-01`. No fork, no branded prop, no `isCheckout` flag.

## Client-Wrapper Pattern

When the variation goes beyond style (different icon, different DOM, different behavior), wrap the shared component in a client-owned component. The wrapper composes the library primitive; it does not re-implement it.

```tsx
// apps/acme/src/components/CheckoutButton.tsx
import { Button, type ButtonProps } from '@company/ui';
import { LockIcon } from './LockIcon';

export type CheckoutButtonProps = Omit<ButtonProps, 'variant'>;

export const CheckoutButton: FC<CheckoutButtonProps> = ({ children, ...props }) => (
  <Button variant="primary" {...props}>
    <LockIcon aria-hidden />
    {children}
  </Button>
);
```

This is `WT-OVERRIDE-02`. The shared `Button` stays generic; behavior and DOM live in the client.

## Decision Table

| Need                                          | Use                                                              |
|-----------------------------------------------|------------------------------------------------------------------|
| Different color only                          | Override CSS variable                                            |
| Different radius / spacing                    | Override CSS variable                                            |
| Different content / icon                      | Slot or render prop                                              |
| Different DOM structure                       | Headless primitive or client wrapper                             |
| Different behavior                            | Client-owned wrapper component                                   |
| One-off variation in one feature              | Scoped class with local CSS variables                            |

Work top-down — reach for the lightest tool that fits.

## Documented Theme Contract

The library MUST publish (in its README or a dedicated `THEME.md`) the list of variables it exposes. Without a documented contract, clients have nothing to target.

### Required Semantic Tokens (`@theme`)

| Token              | Purpose                              |
|--------------------|--------------------------------------|
| `--color-brand`    | Primary brand color                  |
| `--color-surface`  | Background surface color             |
| `--color-text`     | Default text color                   |
| `--radius-card`    | Default container radius             |
| `--font-sans`      | Default sans-serif stack             |

### Optional Semantic Tokens (`@theme`)

| Token                | Purpose                              |
|----------------------|--------------------------------------|
| `--color-muted`      | Subdued background                   |
| `--color-danger`     | Destructive action color             |
| `--shadow-card`      | Elevation for cards                  |
| `--font-mono`        | Monospace stack                      |

### Component Tokens (plain CSS variables, per component)

| Component | Required tokens                                                         | Optional tokens                                |
|-----------|-------------------------------------------------------------------------|------------------------------------------------|
| Button    | `--button-primary-bg`, `--button-primary-fg`, `--button-md-height`      | `--button-radius`, `--button-secondary-bg`, `--button-sm-height`, `--button-lg-height` |
| Card      | `--card-bg`, `--card-radius`                                            | `--card-shadow`, `--card-border`                |
| Input     | `--input-bg`, `--input-border`, `--input-fg`                            | `--input-radius`, `--input-focus-ring`          |

Each component's CSS MUST list its tokens in a comment block at the top of the file so clients can grep for them.

## Quick Reference

| Pattern                          | Use Case                                            | Example                                                          | Rule              |
|----------------------------------|-----------------------------------------------------|------------------------------------------------------------------|-------------------|
| Three-tier fallback              | All component CSS declarations                      | `var(--button-primary-bg, var(--color-brand, #111827))`          | `WT-CONTRACT-01`  |
| `@theme` block                   | Semantic tokens that generate Tailwind utilities    | `@theme { --color-brand: …; --radius-card: …; }`                 | `WT-TAILWIND-01`  |
| `@layer components`              | Component CSS lives here                            | `@layer components { .ui-button { … } }`                         | `WT-TAILWIND-01`  |
| `[data-brand="…"]` scope         | Client brand activation                             | `<html data-brand="acme" data-theme="dark">…</html>`             | `WT-VARIANT-01`   |
| Semantic variants                | All component variant props                         | `variant?: 'primary' \| 'secondary' \| 'ghost' \| 'danger'`     | `WT-VARIANT-01`   |
| Role-named tokens                | All CSS variable declarations                       | `--color-ink-heading`, `--color-surface-base`, `--color-accent` | `WT-VARIANT-01`   |
| Tailwind utility for default sizes | Default radius / shadow / text scale              | `rounded-md`, `shadow-sm`, `text-lg`                            | `WT-VARIANT-01`   |
| Role-named size token            | Component-specific scale that diverges from default | `--radius-card`, `--radius-button`, `--shadow-elevated`         | `WT-VARIANT-01`   |
| Scoped CSS variables             | One-off variation in one feature                    | `.checkout-flow { --button-primary-bg: …; }`                     | `WT-OVERRIDE-01`  |
| Client wrapper                   | Different DOM, behavior, or composition             | `CheckoutButton` composes `Button` and adds an icon              | `WT-OVERRIDE-02`  |

## Quick Decision Tree

1. **Need to re-skin a shared component for one client?**
   - If color/radius only → Override semantic token in client `theme.css`
   - If only one component diverges → Override that component's tokens
   - If only one feature diverges → Scoped class with local CSS variables
   - If DOM/behavior must change → Client-owned wrapper component

2. **Adding a new variant to a shared component?**
   - If semantic intent (`primary`, `ghost`) → Add to the variant union, resolve via CSS variables
   - If brand or visual (`blue`, `acme`) → STOP. Use `[data-brand]` and variable overrides instead.

3. **Adding a new design token?**
   - If it should generate a Tailwind utility (`bg-brand`) → Add to `@theme`
   - If it's component-specific (`--button-primary-bg`) → Plain CSS variable in component CSS
   - Name by role (`--color-ink-heading`, `--radius-card`), NEVER by position (`--ink-0`), color leaf (`--c-violet`, `--color-accent-violet`), or size tier (`--radius-md`) — `WT-VARIANT-01`
   - Need a default size (medium radius, small shadow)? Use the Tailwind utility (`rounded-md`, `shadow-sm`); don't mint `--radius-md` — `WT-VARIANT-01`
   - Need a non-default size or component-specific scale? Mint a role-named token (`--radius-card`, `--radius-button`, `--shadow-elevated`) — `WT-VARIANT-01`

4. **Importing CSS in the client app?**
   - Library stylesheet FIRST, client `theme.css` SECOND, app CSS LAST. Anything else breaks the cascade.
