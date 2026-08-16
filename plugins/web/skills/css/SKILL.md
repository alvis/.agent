---
name: css
description: Scaffold or maintain a project's root stylesheet using the CSS-only light, dark, and system color-mode contract. Use for theme.css, globals.css, or app.css setup, migration from class-driven dark mode, semantic token wiring, or color-mode corrections. Detect conflicts, obtain migration approval, preserve existing tokens, and edit CSS only.
metadata:
  intelligence: medium
argument-hint: "[project root or stylesheet] [--tokens=<roles>]"
---

# CSS color modes

Create or update exactly one root stylesheet so color modes satisfy the four `CSS-MODE-01..04` rules in the `plugin:web:standard:css` standard. This skill never writes JavaScript, application components, or an unapproved framework migration. A consumer may toggle `data-theme`; system mode is the absence of that attribute.

## Boundaries

- Use for: creating or merging the root theme stylesheet, migrating from `.dark`/Tailwind class-mode/JS-driven theming to the `:root[data-theme]` contract, wiring the two-tier `--theme-*` → `--ui-*` token chain, and fixing color-mode defects.
- Do not use for: runtime toggle JavaScript (hand off `references/runtime-toggle.md`), component styling, or brand semantics owned by Tailwind `@theme` — `plugin:web:standard:theming` composes with this skill: `@theme` owns brand semantics while this skill's `@layer theme` block owns the per-mode palette and active UI tokens. Token and attribute names follow `plugin:coding:standard:naming`.

## Inputs

- **Required**: a project root or an explicit stylesheet path inside the target project.
- **Optional**: `--tokens=<roles>` naming the semantic roles to wire; otherwise add only requested or already-used roles.
- **Prerequisites**: read access to the project CSS plus `tailwind.config.{js,ts,mjs}` and `postcss.config.*` when present, needed to detect a conflicting `darkMode: 'class'`.

## Workflow

1. Locate the target. If an explicit stylesheet is supplied, validate that it is inside the target project. Otherwise search, in order, for `theme.css`, `globals.css`, `app.css`, `styles/index.css`, then entry-shaped `src/**/*.css`, excluding generated/vendor directories. If multiple plausible roots remain, list them and ask which one owns global tokens — do not guess. If none exists, propose `src/theme.css` when `src/` exists, otherwise `theme.css` at the root.
2. Classify the existing contract. Read the complete target plus Tailwind/PostCSS configuration. Search project CSS/config/runtime source for `prefers-color-scheme`, `data-theme`, `.dark`, `[data-mode]`, `[data-color-scheme]`, `darkMode: 'class'`, `@layer theme`, `--theme-`, `--ui-`, and code that adds/removes theme classes. Record detection state: chosen file, existing mode selectors, raw and semantic tokens, framework integration, conflicts, and whether creation or merge is proposed.
3. Gate on approval for destructive paths. If the project already uses `.dark`, a noncanonical attribute, Tailwind class mode, JS class toggling, duplicate theme layers, or incompatible token ownership, stop before editing. Present the exact occurrences and a bounded migration plan — for Tailwind class mode, propose `darkMode: ['selector', '[data-theme="dark"]']` in the Tailwind config, or removing the option entirely on Tailwind v4 where the selector strategy is default. Obtain explicit approval for every file beyond the selected stylesheet; without it, leave source untouched and return the plan.
4. If the existing contract is compatible, proceed without ceremony. Preserve custom colors, imports, layer order, comments that explain policy, unknown token roles, and framework directives. Never replace the entire stylesheet merely to match the template. Use [the theme template](references/theme.css.template) as structural guidance and [the runtime-toggle handoff](references/runtime-toggle.md) as consumer guidance.
5. Write the contract:
   1. Create the proposed file only after its location is unambiguous. For an existing file, merge into its `@layer theme` block or insert a new block after imports and required framework directives.
   2. Define tier-one `--theme-light-<role>` and `--theme-dark-<role>` source values once. Map them to tier-two `--ui-<role>` semantic values; add only requested or already-used roles.
   3. Keep explicit overrides exactly at `:root[data-theme="light"]` and `:root[data-theme="dark"]`.
   4. Keep system branches at `:root:not([data-theme])` inside both light and dark `prefers-color-scheme` queries.
   5. Put every mode branch inside `@layer theme` and set the matching `color-scheme` value.
   6. If runtime toggling is requested, point to [the runtime-toggle handoff](references/runtime-toggle.md); do not implement the JavaScript here.
6. Run the verification below; when a check fails, correct the owned CSS and re-run that check. Repeat until every check passes, or stop partial when correction requires an unapproved migration and show the required diff instead of looping.

## Verification

Re-read the full resulting stylesheet and check each role across every branch:

- `CSS-MODE-01`: explicit selectors are only `:root[data-theme="light"]` and `:root[data-theme="dark"]`; fail on `.dark`, `[data-mode]`, or `[data-color-scheme]` in the owned contract.
- `CSS-MODE-02`: both system media queries contain `:root:not([data-theme])` and map all active roles.
- `CSS-MODE-03`: all mode declarations are inside `@layer theme` and every branch sets correct `color-scheme`.
- `CSS-MODE-04`: each `--ui-<role>` maps to complete light/dark tier-one tokens; no branch or role is missing.

Also verify balanced CSS syntax, imports/layers retained in legal order, and no non-approved files changed.

## Completion

Return status, stylesheet path, created/edited files, detection summary, approved migration actions, tokens preserved/added, per-rule `CSS-MODE` results, runtime-toggle reference, and unresolved conflicts.
