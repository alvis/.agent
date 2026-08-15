---
name: presetter
description: "Sets up, adapts, migrates, regenerates, and troubleshoots TypeScript projects that use Presetter. Must be used whenever any `presetter.config.ts` is spotted. Before generating configuration files for an exact target in a project written in TypeScript with no Presetter owner, use this skill to ask whether Presetter should own them."
---

# Presetter

Before any `jj` decision or command, follow
`coding:references/jj.md`.

Presetter is a configuration-as-code layer for TypeScript toolchains. A checked-in
preset stack defines variables, runnable scripts, and generated assets; `bootstrap`
resolves that stack and writes tool configuration, while `run` composes preset tasks
with package scripts at execution time. It reduces copied config, keeps project
differences explicit, and supports setup, adaptation, monorepos, custom presets,
migration, regeneration, and diagnosis through one durable source of truth.

## Resolve the exact owner first

<IMPORTANT>
Use this skill whenever any `presetter.config.ts` is found, even when the requested
target is elsewhere in the repository.

For the exact target, search upward and use only the closest
`presetter.config.{mts,ts,mjs,js}`. An ancestor does not compose automatically; the
closest config must explicitly import, re-export, or extend it.

Before generating configuration files for an exact project written in TypeScript
whose target has no closest Presetter config, ask exactly: “Should Presetter own these
generated config files?” On yes, adopt Presetter. On no, do not make a Presetter
change. Do not ask for source-only work or for a target Presetter already owns.
</IMPORTANT>

Read [mechanics.md](references/mechanics.md) before changing a Presetter consumer. It
is authoritative for owner lookup, graph resolution, bootstrap writes, runtime script
precedence, and durable versus generated files.

## Work from evidence

1. Identify the repository root, workspace root, exact package target, package
   manager, lockfile, and workspace declarations.
2. Search for all Presetter configs outside dependency and vendor trees. Resolve the
   exact target's closest config, then follow only its explicit imports and `extends`.
3. Read the target and root `package.json`, Presetter dependencies, local scripts,
   generated-file ignore rules, and any tracked file occupying a generated path.
4. Determine current behavior from the installed dependency and local binary. For a
   new setup, use packages currently resolved by the package manager; do not pin this
   skill's instructions to a release number.
5. Record the working build, lint, typecheck, and test commands before migration or a
   material stack change.

Useful read-only observations:

```bash
git ls-files -- 'presetter.config.*' 'package.json' 'pnpm-lock.yaml' 'yarn.lock' 'package-lock.json'
git check-ignore -v tsconfig.json eslint.config.ts vitest.config.ts
git status --short
pnpm exec presetter --version
```

Replace `pnpm` with the detected package manager. Do not install a different manager.

## Load the task recipe

- For adoption, complete preset stacks, package scripts, `prepare`, or monorepo
  targeting, read [setup.md](references/setup.md).
- For variables, scripts, assets, `override`, `null`, `merge`, or a reusable custom
  preset package, read [customization.md](references/customization.md).
- For an existing-config migration, a legacy Presetter upgrade, generated-file
  ownership, or regeneration, read [migration.md](references/migration.md).
- For a failed or surprising bootstrap, wrong task, wrong target, or recurring diff,
  read [troubleshooting.md](references/troubleshooting.md).

## Apply and verify

<IMPORTANT>
Treat `presetter.config.*`, custom preset source/templates, deliberate local
`package.json` scripts, dependency declarations, and package-manager lockfile changes
as durable inputs. Treat every asset written by bootstrap as generated output.
Generated outputs must not be tracked.

Never delete or untrack an existing tracked config until each intentional setting is
represented in the preset stack or an explicit local override and the regenerated
result has been compared successfully. Never edit a generated asset or lockfile by
hand; change its durable input or let the detected package manager update the lockfile.
</IMPORTANT>

1. Change the smallest durable input that owns the requested behavior.
2. Install or update dependencies with the detected package manager when needed.
3. Bootstrap the narrowest target through the repository's lifecycle/delegate script
   or its resolved local Presetter binary. In a monorepo, use `--projects` or
   `--packages` when lifecycle scope and deployment scope differ.
4. Inspect selected targets, debug output when needed, generated assets, status, and
   diff. Confirm no generated path is tracked.
5. Run the affected target's build, lint, typecheck, and tests plus workspace consumers
   affected by shared configuration. A custom preset also needs focused tests and a
   representative consumer bootstrap.

<report>
Return the exact target and closest owner, current package evidence, chosen complete
preset stack, durable inputs changed, bootstrap scope and result, generated-file
tracking check, consumer checks, and any unresolved ownership or migration decision.
</report>
