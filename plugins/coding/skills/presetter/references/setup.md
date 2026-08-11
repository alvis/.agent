# Setup and project-shape recipes

Use this reference for first adoption, choosing a complete stack, package-script
delegates, or monorepo bootstrap scope.

## Contents

- [Select a complete stack](#select-a-complete-stack)
- [Adopt a standalone Node ESM project](#adopt-a-standalone-node-esm-project)
- [Add package-script delegates](#add-package-script-delegates)
- [Set up a Node ESM monorepo](#set-up-a-node-esm-monorepo)
- [Control monorepo lifecycle scope](#control-monorepo-lifecycle-scope)

## Select a complete stack

Inspect the installed preset packages before composing them; presets may change their
internal foundations over time. Add a preset only for behavior not already supplied.

| Project shape | Complete top-level stack | Why |
| --- | --- | --- |
| Plain ESM TypeScript library | `esm` | ESM already extends essentials and supplies a working module build target. |
| ESM Node application | `esm, node` | ESM supplies foundation/module output; Node supplies runtime config. |
| CommonJS Node application | `cjs, node` | CJS supplies foundation/module output; Node supplies runtime config. |
| Strict ESM library | `esm, strict` | Strict is an independent quality layer; this is the simple `xception` precedent. |
| React web library | `esm, strict, web, react` | Module build, quality, browser, and React each contribute distinct behavior. Add `storybook` only when used. |
| Next application | `next` | Next already composes ESM, Node, strict, web, and React. Do not add those again. |
| Node ESM monorepo root | `monorepo, node, esm` | Monorepo supplies essentials plus strict and workspace overrides; Node and ESM complete runtime and module build. This is the `core` root pattern. |

`essentials` alone is intentionally incomplete for compilation: its
`build:typescript` task exits until a module target such as ESM or CJS is supplied.
Likewise, `monorepo` does not choose a module target. Do not redundantly list
`essentials` under ESM, CJS, hybrid, or monorepo, and do not surround `next` with the
capabilities it already composes.

Real repositories are evidence, not universal policy. `core` demonstrates explicit
ancestor composition and a complete monorepo stack; `xception` demonstrates a small
standalone `esm, strict` stack. Preserve a consumer's actual runtime and framework
requirements instead of copying either stack blindly.

## Adopt a standalone Node ESM project

For a new pnpm consumer, install the currently resolved packages without embedding a
release number in the config:

```bash
pnpm add -D presetter @presetter/preset-esm @presetter/preset-node
```

Use the equivalent add command for the detected manager. In an existing workspace,
follow its catalog, workspace protocol, and version-range conventions.

```typescript
// presetter.config.ts
import esm from '@presetter/preset-esm';
import node from '@presetter/preset-node';
import { preset } from 'presetter';

import { name } from './package.json' with { type: 'json' };

export default preset(name, {
  extends: [esm, node],
});
```

Add durable delegates to `package.json`, then bootstrap once:

```json
{
  "scripts": {
    "build": "run build",
    "lint": "run lint --",
    "prepare": "run prepare",
    "prepublishOnly": "run prepublishOnly",
    "test": "run test --",
    "test:coverage": "run test:coverage --",
    "test:watch": "run test:watch --",
    "typecheck": "run typecheck --"
  }
}
```

```bash
pnpm exec presetter bootstrap
pnpm run build
pnpm run lint
pnpm run typecheck
pnpm test
```

## Add package-script delegates

Use delegates only for tasks the project exposes. Common delegates are `build`,
`lint`, `prepare`, `prepublishOnly`, `release`, `test`, `test:coverage`, `test:watch`,
and `typecheck`; framework presets may add `start`, `storybook`, or other tasks.

`"prepare": "run prepare"` invokes the preset's `prepare`, which runs setup tasks and
bootstrap. Because package scripts override preset entries, preserve existing local
lifecycle work explicitly:

```json
{
  "scripts": {
    "prepare": "run prepare && node scripts/prepare-local.mjs"
  }
}
```

Do not replace a meaningful local command merely to match the standard delegate. Some
repositories intentionally use another lifecycle script or a direct filtered
`presetter bootstrap`; that is a local constraint, not a default for new consumers.

## Set up a Node ESM monorepo

Install Presetter and the distinct root capabilities in the workspace root:

```bash
pnpm add -Dw presetter @presetter/preset-monorepo @presetter/preset-node @presetter/preset-esm
```

```typescript
// presetter.config.ts
import esm from '@presetter/preset-esm';
import monorepo from '@presetter/preset-monorepo';
import node from '@presetter/preset-node';
import { preset } from 'presetter';

import { name } from './package.json' with { type: 'json' };

export default preset(name, {
  extends: [monorepo, node, esm],
});
```

Packages without a closer config inherit this root because nearest-config lookup reaches
it. A package needing distinct behavior must explicitly compose the root:

```typescript
// packages/ui/presetter.config.ts
import react from '@presetter/preset-react';
import web from '@presetter/preset-web';
import root from '../../presetter.config';
import { preset } from 'presetter';

export default preset('@scope/ui', {
  extends: [root, web, react],
});
```

## Control monorepo lifecycle scope

Normally each included workspace package carries `"prepare": "run prepare"`; the
package manager invokes that lifecycle for packages participating in installation, and
each package bootstraps itself through its closest config. When deployment filters,
disabled lifecycle scripts, or root-only setup make that scope unreliable, call
bootstrap directly with an explicit positive selection.

```bash
pnpm exec presetter bootstrap \
  --projects "." "packages/*" "apps/*" \
  --projects "!packages/deploy-skipped"

pnpm exec presetter bootstrap \
  --packages "@scope/*" "!@scope/deploy-skipped"
```

`--projects` matches directories containing `package.json`; `--packages` matches
declared package names. Both flags add to one selection set. A `!` pattern only
subtracts and can exclude a target selected by either flag; a negative pattern alone
selects nothing. Quote globs so the shell does not expand them first.

After a multi-target run, review every selected package. Presetter continues after an
individual failure, aggregates failures, and exits nonzero when any target failed.
