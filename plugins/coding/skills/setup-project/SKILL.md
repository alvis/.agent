---
name: setup-project
description: Ensure project structure exists before development, creating barebone scaffolding only if needed. Use when initializing new projects, validating project setup, or ensuring monorepo component structure.
requirements:
  intelligence: low
context: fork
argument-hint: "<target-path> [--type=app|lib|service]"
---

# Setup Project

Before any `jj` decision or command, follow
`coding:references/jj.md`.

Ensures a target path is ready for development: a quick validation first, and
a minimal bootstrap that mimics similar projects in the monorepo only when
essential files are missing. Feature and business-logic code is owned by
`coding:write-code`, which invokes this skill as its conditional first step.

Applicable standards: `file-structure` (directory layout), `universal/write`,
`typescript/write` (TypeScript configuration), and `documentation/write`.

## Boundaries

- Use for: validating that a project path has essential structure,
  bootstrapping a minimal package (package.json, config files, placeholder
  source), and installing dependencies with the detected package manager.
- Do not use for: implementing business logic or feature code
  (`coding:write-code`), modifying files in an already-configured project,
  installing unnecessary dependencies, or creating hierarchies beyond the
  minimum viable structure.
- Reject when: the target path is outside the repository, or no monorepo root
  can be detected. When the project is already fully configured, report
  "already set up" instead of touching it.

## Inputs

- **Required**: `<target-path>` — the project directory to validate or create.
- **Optional**: `--type=app|lib|service` (auto-detected from the path and
  siblings when omitted); `--from-composite` (set by `coding:write-code`; run
  non-interactively and defer reporting style to the composite).
- **Prerequisites**: a detectable monorepo root; for bootstrap, at least one
  similar project to mimic.

## Workflow

1. Parse the target path and flags. Quick check — fast `ls`-level commands
   only, no deep inspection, since the project is usually already set up:
   target exists, `package.json` exists, a source directory (`src`/`source`)
   with files exists, project config files (for example `vitest.config.ts`)
   exist. List immediate directory contents only; this step takes seconds.
2. Decide: if `package.json` and source exist and are consistent with similar
   projects in the monorepo, skip to the final report as "already set up".
   Otherwise proceed to bootstrap.
3. Bootstrap (conditional): scan similar projects for common patterns
   (package.json fields, tsconfig, config files), then create a minimal
   `package.json`, essential config files, and placeholder source files, and
   install dependencies with the detected package manager (pnpm/npm/yarn).
   <IMPORTANT>Never create or copy `.gitignored` files or directories.</IMPORTANT>
4. Verify the setup using the checks below; when a check fails with a minor
   issue, fix the cause and re-run that check. On a critical failure, roll
   back the files created in step 3 and retry the bootstrap once. Repeat until
   every check passes or a concrete blocker remains, then report the blocker
   instead of looping.

## Verification

- Essential files exist: `package.json` (with required fields), a TypeScript
  config, and `src/` or `lib/` with at least a placeholder entry point.
- Dependencies resolve when installation was attempted.
- Structure is consistent with similar projects in the monorepo.

## Completion

Report the target path, detected project type, whether the project was
already set up, files created, dependencies installed (yes/no/skipped),
whether the project is ready for development, and the immediate next step.
For a rejection, name the failed condition (path outside repository, no
monorepo root) and suggest a valid target.
