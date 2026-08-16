---
name: react
description: Use when creating, editing, reviewing, or routing work involving React, JSX, hooks, components, accessibility behavior, project structure, tests, or Storybook stories; this router selects React standards while Coding owns generic execution.
metadata:
  intelligence: low
---

# React Standards Router

Load only the React standards relevant to the current work and route the work
itself to its owning skill. This skill supplies context; it does not create
implementation teams or duplicate another skill's workflow.

## Boundaries

- Use for: selecting and loading React standards when React work happens —
  editing `.tsx`/`.jsx` files, building components, authoring `use*` hooks,
  or writing Storybook stories — and routing enforcement, implementation, and
  review to their owning skills.
- Do not use for: mechanical lint execution (`react:lint`), implementation
  (`coding:write-code`), semantic review (`coding:review-code`), or work with
  no React surface such as backend, CLI, or build configuration.

## Inputs

- **Required**: the files or task at hand, enough to identify which React
  surfaces are touched (components, hooks, stories, structure, theming).
- **Prerequisites**: set `REACT_PLUGIN_ROOT` by resolving `../..` from the
  absolute directory containing this loaded `SKILL.md`; React standards live
  under `${REACT_PLUGIN_ROOT}/standards/`.

## Standards

Standards live under `${REACT_PLUGIN_ROOT}/standards/`; rule
files in each standard's `rules/` directory define the prefixed violation
codes:

- `accessibility` (`A11Y-*`): semantics, keyboard access, ARIA, focus, forms,
  and screen readers.
- `components` (`RC-*`): component boundaries, props, state, naming, and
  performance.
- `hooks` (`RH-*`): dependencies, cleanup, stable references, return shapes,
  and composition.
- `project-structure` (`RPS-*`): placement, feature boundaries, and promotion
  paths.
- `storybook` (`SB-*`): story naming, coverage, controls, interactions, and
  purity.

For shared-component theme contracts (`[data-brand]` scopes, CSS-variable
overrides, Tailwind theme integration), apply the web plugin's `theming`
standard (`WT-*`) when that plugin is available; otherwise record that
theming rules were not evaluated.

## Workflow

1. Identify the surfaces the task touches and load only their standards.
   Read `write.md` before authoring and `scan.md` when reviewing; read an
   individual rule only after its scan identifies a candidate violation.
2. When authoring, pair `components` with `accessibility` — every component
   must be accessible; add `hooks` whenever a `use*` function is involved,
   add `storybook` for `*.stories.tsx` files, and decide the
   `project-structure` reusability tier before drafting.
3. Route the work itself:
   - Mechanical enforcement across one or more eligible files: `react:lint`
     — never route React linting through generic lint first.
   - Feature or bug implementation: `coding:write-code` with the applicable
     React standards.
   - Generic semantic review: `coding:review-code` with the applicable React
     standards.
   - Visual design or runtime diagnosis: recommend an optional web skill when
     available; otherwise state the recommendation without invoking it.
4. When a scan or review flags a violation code, open the matching rule file
   under the standard's `rules/` directory for the precise definition and
   remediation, apply or route the fix, and re-run the relevant `scan.md`
   heuristic to confirm. Repeat until every flagged code is resolved or a
   concrete blocker remains, then report the blocker instead of looping.

## Verification

- Every touched surface has its standard loaded, and `accessibility` is
  loaded alongside `components` whenever authoring.
- Every flagged violation code was checked against its rule file and either
  re-scanned clean, routed to its owning skill, or reported as blocked.
- The theming decision is recorded — applied, or explicitly noted as not
  evaluated when the web plugin is absent.

## Completion

Report the standards loaded, violation codes flagged and their resolution
(fixed, routed, or blocked), routing decisions made, and whether theming was
evaluated or explicitly skipped.
