# WT-VARIANT-01: Variants and Token Names Express Semantic Role, Never Appearance or Size

## Intent

Names — both component variant unions AND CSS variable tokens — describe what something MEANS, not what it LOOKS LIKE. Semantic names (`primary`, `secondary`, `ghost`, `danger`, `--color-ink-heading`, `--color-surface-base`, `--radius-card`) survive re-skins and brand switches; visual, positional, or color-leaf names (`blue`, `rounded`, `acme`, `--ink-0`, `--c-violet`, `--line-soft`, `--glass-bg`, `--radius-md`) hardcode design decisions into the contract and force a rename every time a value changes. Brand switching is the job of `[data-brand]` (color mode is the job of `[data-theme]` per `CSS-MODE-*`), not a prop; size scaling is the job of Tailwind utilities, not a custom token whose name IS the size.

The rule has three pillars:

1. **Variants are roles** — `primary | secondary | ghost | danger`, never `blue | rounded | acme`.
2. **Token names are roles** — `--color-ink-heading`, never `--ink-0`. Color words MUST NOT appear in the name (`--color-accent`, never `--color-accent-violet`). If multiple accents are needed, differentiate by role (`--color-accent-primary`, `--color-link`, `--color-callout`), never by color.
3. **Sizes use Tailwind utilities or role-named custom tokens** — reach for `rounded-md` / `shadow-sm` / `text-lg` for the default scale; mint a custom token only when the value carries a role (`--radius-card`, `--radius-button`, `--shadow-elevated`, `--text-body`). NEVER mint `--radius-md`, `--shadow-sm`, `--text-body-lg` — those re-implement Tailwind's scale behind a redundant indirection.

## Fix

- Use semantic union literals for `variant`: `primary | secondary | ghost | danger`
- Use semantic union literals for `size`: `sm | md | lg`
- Remove any `brand`, `client`, `color`, or visually descriptive variant unions — those concerns live in CSS variables and `[data-brand]` scoping (color mode lives on `[data-theme]` per `CSS-MODE-*`, not on a prop either)
- Name CSS tokens with the pattern `--<category>-<role>[-<modifier>]`:
  - Color: `--color-<role>` (`--color-ink-heading`, `--color-surface-base`, `--color-border-subtle`, `--color-accent`, `--color-pillar-ingest`, `--color-surface-glass`)
  - Typography role: `--text-<role>` (`--text-eyebrow`, `--text-body`), `--tracking-<role>` (`--tracking-eyebrow`)
  - Radius / shadow: `--radius-<role>` (`--radius-card`, `--radius-button`, `--radius-modal`), `--shadow-<role>` (`--shadow-elevated`, `--shadow-overlay`)
- For default sizes, use Tailwind utilities directly (`rounded-md`, `shadow-sm`, `text-lg`); do NOT mint `--radius-md`, `--shadow-sm`, `--text-body-lg`
- For non-default sizes, mint a role-named token (`--radius-card`, not `--radius-md-plus` or `--radius-2`)
- Forbidden patterns:
  - Positional digits (`--ink-0`, `--bg-1`, `--radius-2`)
  - Color words anywhere in the name (`--c-violet`, `--bg-blue`, `--color-accent-violet`)
  - Visual modifiers as the primary token (`--line-soft`, `--glass-bg`, `--card-shadow-soft`)
  - Size-tier suffix as the token's role (`--radius-md`, `--shadow-sm`, `--text-body-lg`)

```typescript
// ❌ BAD: visual / brand identity baked into the type
export type ButtonProps = {
  variant?: 'blue' | 'rounded' | 'wide';
};

// ❌ BAD: brand leaked into the component API
export type ButtonProps = {
  brand?: 'acme' | 'globex';
  client?: 'acme' | 'globex';
};

// ✅ GOOD: semantic intent, brand handled by [data-brand] (color mode by [data-theme])
export type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};
```

```css
/* ❌ BAD: positional indexing — what does -0 mean? */
:root {
  --ink-0: #0a0a0a;
  --ink-1: #4b5563;
  --bg-0: #ffffff;
  --bg-1: #f9fafb;
}

/* ❌ BAD: color word anywhere in the name — strip it; the role is `accent` */
:root {
  --c-violet: #7c3aed;
  --color-accent-violet: #7c3aed;   /* still wrong — drop `-violet` */
  --line-soft: #e5e7eb;
  --glass-bg: rgba(255, 255, 255, 0.6);
}

/* ❌ BAD: size-tier as the token's role — Tailwind already ships these */
@theme {
  --radius-md: 0.5rem;        /* use rounded-md */
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.06);  /* use shadow-sm */
  --text-body-lg: 1.125rem;   /* use text-lg */
}

/* ✅ GOOD: role-named — re-skinnable without renaming the contract */
@theme {
  --color-ink-heading: #0a0a0a;
  --color-ink-body: #1f2937;
  --color-ink-muted: #4b5563;
  --color-ink-subtle: #9ca3af;

  --color-surface-base: #ffffff;
  --color-surface-raised: #f9fafb;
  --color-surface-overlay: #ffffffee;
  --color-surface-glass: rgba(255, 255, 255, 0.6);

  --color-border-subtle: #f3f4f6;
  --color-border: #e5e7eb;
  --color-border-strong: #d1d5db;

  --color-accent: #7c3aed;          /* role only — NOT --color-accent-violet */
  --color-pillar-ingest: #14b8a6;   /* `ingest` is a product-domain role */
  --color-pillar-memory: #8b5cf6;
  --color-pillar-reflex: #f97316;

  --radius-card: 0.75rem;     /* role: card; value diverges from rounded-md */
  --radius-button: 0.5rem;    /* role: button */
  --radius-modal: 1rem;       /* role: modal */
  --shadow-elevated: 0 10px 30px rgb(0 0 0 / 0.12);
  --text-display-md: 3rem;    /* tier-as-role: Tailwind ships no display tier */
}
```

```tsx
// ✅ GOOD: default sizes use Tailwind utilities directly
<button className="rounded-md shadow-sm text-lg" />

// ❌ BAD: re-implements Tailwind's scale behind redundant tokens
<button style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }} />
```

## Code Superpowers

- Grep exported Props types for prop names `theme`, `client`, `brand`, `color`, `tone` — flag for review
- Grep variant unions for visually descriptive literals (`'blue'`, `'red'`, `'rounded'`, `'wide'`, `'tall'`) — every match is a violation
- Grep CSS for positional-index tokens: `--[a-z-]+-\d+\s*:` — every match is a violation
- Grep CSS for color words in token names: `--[a-z-]*-(red|orange|amber|yellow|green|teal|cyan|blue|indigo|violet|purple|pink|gray|grey|black|white)\b` — every match is a violation (`--color-accent` passes; `--color-accent-violet` fails)
- Grep for visual-descriptor leaves without a category role: `--(glass|soft|hard|strong|light|dark)-[a-z]+\s*:` at the start of a token name
- Grep for size-tier tokens that duplicate Tailwind's scale: `--(radius|shadow|text|spacing)-(xs|sm|md|lg|xl|2xl|3xl|4xl|5xl)\s*:` — every match is a violation unless an explicit role precedes the size (e.g. `--text-display-md` passes because `display` is the role and Tailwind ships no `display` tier)
- Confirm component CSS reaches for Tailwind utility classes (`rounded-md`, `shadow-sm`, `text-lg`) for default scale values, only minting a custom token when the value diverges or carries a role

## Common Mistakes

1. Adding `variant="acme"` so a client app gets its specific styling — should be `[data-brand="acme"]` with variable overrides
2. Letting designers' Figma layer names (`Button / Blue / Large`) leak into prop unions or token names verbatim
3. Mixing semantic and visual variants in the same union (`'primary' | 'blue' | 'ghost'`)
4. Splitting one semantic intent across two variants (`'primary'` and `'primary-rounded'`) instead of using a separate `shape` axis or scope override
5. Numbering tokens by visual depth (`--bg-0`, `--bg-1`, `--bg-2`) instead of naming the surface role (`base`, `raised`, `overlay`)
6. Shipping `--c-violet` (or even `--color-accent-violet`) — the color word must NEVER appear in the name. The brand accent is `--color-accent`; a re-skin to teal swaps the value, the name stays put. If multiple accents are needed, differentiate by role (`--color-accent-primary`, `--color-link`, `--color-callout`), not by color
7. Treating `--glass-bg` as a primary token — glass is a surface role, so name it `--color-surface-glass`
8. Letting figma-layer or utility-class names (`--line-soft`, `--text-lg`) leak into the contract verbatim
9. Re-naming Tailwind's scale into custom tokens (`--radius-md`, `--shadow-sm`, `--text-body-lg`) — use the Tailwind utility directly OR rename to the role (`--radius-card`, `--shadow-elevated`, `--text-body`)
10. Reaching for `--radius-md-plus` when a button radius needs to be one notch larger — mint `--radius-button` instead; the role is "button's radius", not "medium plus a bit"

## Edge Cases

- A `tone` prop with semantic values (`'info' | 'success' | 'warning' | 'danger'`) is acceptable when the component genuinely conveys those states (Alert, Badge); it is still semantic, not visual
- Polymorphic `as` props are NOT variants — they pick the rendered element, not the visual intent
- `--text-display-md`, `--text-display-sm`, `--text-display-lg`: allowed ONLY when Tailwind has no equivalent size variant for that role. `display` is the role; once Tailwind ships a display tier of the same size, the custom token MUST go away
- Tailwind's own numeric utility scales (`--spacing-1`, `--spacing-2`, …) referenced via Tailwind utilities: this rule governs CUSTOM tokens you mint, not Tailwind's internal token namespace
- Existing visual-name tokens kept ONLY via the standard's exception policy (`false_positive` / `no_workaround`), each with `rule_id`, `evidence`, `temporary_mitigation`, `follow_up_action`

## Related

RC-PROPS-01, RC-STRUCT-04, WT-CONTRACT-01, WT-CONTRACT-02, WT-VARIANT-02, WT-OVERRIDE-01
