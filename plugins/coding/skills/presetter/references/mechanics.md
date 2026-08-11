# Presetter mechanics

Use this reference as the authority for reasoning about a consumer. Task recipes may
apply these rules but must not redefine them.

## Contents

- [Exact-target config lookup](#exact-target-config-lookup)
- [Preset graph and two-pass resolution](#preset-graph-and-two-pass-resolution)
- [Bootstrap writes assets](#bootstrap-writes-assets)
- [Runtime script composition](#runtime-script-composition)
- [Durable and generated state](#durable-and-generated-state)

## Exact-target config lookup

Given a target package root, Presetter checks that directory for
`presetter.config.mts`, `.ts`, `.mjs`, then `.js`. It searches upward through package
boundaries to the repository root, but loads only the first path found. Therefore:

- the closest config owns the target;
- a root config can own packages that have no closer config;
- finding multiple configs does not make an implicit chain;
- a closer config composes an ancestor only by importing, re-exporting, or listing it
  in `extends`.

```typescript
// packages/api/presetter.config.ts
import root from '../../presetter.config';
import node from '@presetter/preset-node';
import { preset } from 'presetter';

export default preset('@scope/api', {
  extends: [root, node],
});
```

Without the `root` import and `extends` entry, this package stands alone. This is why
ownership is resolved from the exact target before deciding whether to adopt or edit.

## Preset graph and two-pass resolution

`preset()` gives a definition an ID. `extends` builds an explicit graph. Presetter
resolves each `variables`, `scripts`, and asset value twice:

1. The initial pass walks extended presets from left to right, merges each child graph,
   then applies the current definition.
2. The final pass starts with the complete initial value and walks the same graph in
   the same order, applying every `override`; the owning definition's override is last.

For ordinary content, plain objects deep-merge, arrays extend according to Presetter's
merge rules, and a defined primitive or `null` replaces the current value. A content
function receives `(current, context)` and owns the returned value, so preserve
upstream content explicitly when that is intended.

```typescript
import { asset, merge, preset } from 'presetter';

export default preset('consumer', {
  extends: [foundation, capability],
  override: {
    assets: {
      '.gitignore': asset<string[]>((current) => [
        ...(current ?? []),
        '/generated-client',
      ]),
      'tsconfig.json': asset((current) =>
        merge(current, {
          compilerOptions: { noEmit: true },
        }),
      ),
      'vitest.config.ts': null,
    },
  },
});
```

Use `override` for changes that must see the fully composed initial value. Use `null`
to remove an inherited asset from the output set; bootstrap logs it as skipped.

## Bootstrap writes assets

`presetter bootstrap` resolves the target context, loads the closest config, resolves
the graph and variables, computes every asset, serializes it by extension, creates
parent directories, and writes each non-null asset to the target root. The write is an
overwrite; bootstrap does not merge with an existing file on disk. Merge behavior
happens in memory from preset definitions and content functions before the write.

Consequences:

- represent edits in a config, preset template, or override, never in generated output;
- inspect tracked files before the first bootstrap because a matching asset path will
  be overwritten;
- keep generated paths ignored and untracked;
- expect repeated bootstrap runs to regenerate the same paths after stack changes;
- in multi-target runs, Presetter attempts every selected project, then reports all
  failures together and exits nonzero.

## Runtime script composition

Bootstrap does not write `package.json` scripts. `presetter run`, `run`, `run-s`, and
`run-p` resolve scripts at execution time:

1. Presetter resolves preset scripts through the same initial and override passes.
2. It overlays the target package's checked-in `scripts`; a local script with the same
   name wins as the task entry.
3. While expanding a composed `run <task>` command, the preset template is preferred,
   then a non-self-referential local task. This lets a delegate such as
   `"build": "run build"` call the preset's `build` without recursing into itself.
4. Preset package binary directories are added to `PATH` for task execution. A library
   dynamically imported by project code may still need to be a direct dependency.

Use `presetter run <task> --template` to suppress local scripts and execute the preset
template for comparison. Arguments for the underlying task follow `--`:

```bash
pnpm exec presetter run test -- --watch
pnpm exec presetter run build --template
```

## Durable and generated state

Durable inputs are:

- `presetter.config.*` and imported preset modules;
- custom preset source and template files;
- intentional local `package.json` delegates or overrides;
- dependency declarations and package-manager lockfile changes.

Generated outputs are every asset bootstrap writes, including tool configs and ignore
files. They must be ignored and untracked. If a generated `.gitignore` is itself
ignored, its durable source is the preset asset that produces it.

Before changing ownership, use both index and ignore evidence:

```bash
git ls-files -- tsconfig.json eslint.config.ts vitest.config.ts
git check-ignore -v tsconfig.json eslint.config.ts vitest.config.ts
git status --short
```
