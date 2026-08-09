---
name: lint
description: Use when React JSX, components, hooks, accessibility, project structure, tests, or Storybook files need mechanical standards enforcement through the shared Coding lint workflow; React owns framework rules while Coding owns generic execution and reporting.
model: opus
argument-hint: "[specifier] [--scope=SCOPE]"
---

# React Lint

Set `REACT_LINT_SKILL_DIR` to the absolute directory containing this loaded
`SKILL.md` before resolving its profile.

Route React lint requests to the shared Coding lint workflow with the bundled
React profile. The delegated Coding skill owns discovery, batching, execution,
review, and reporting; this skill only binds the profile.

## Boundaries

- Use for: mechanical standards enforcement on `.tsx`/`.jsx` files, including
  their stories and tests.
- Do not use for: non-React files (invoke the Coding lint skill directly),
  semantic or architectural review (`coding:review-code`), or standards
  selection (`react:react`).

## Workflow

1. Forward the request exactly once through `Skill(coding:lint *)` using
   `$ARGUMENTS --profile="${REACT_LINT_SKILL_DIR}/assets/profile.json"`. Do not parse,
   reorder, or discard the caller's specifier or scope.
2. Wait for the delegated skill and return its report unchanged. Perform no
   independent discovery, scanning, linting, review, aggregation, or
   framework dispatch; if the delegated call fails, report its error verbatim
   instead of retrying with altered arguments.
