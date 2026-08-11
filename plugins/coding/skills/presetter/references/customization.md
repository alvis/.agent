# Customization and custom presets

Use this reference to adapt an existing stack or package reusable Presetter behavior.

## Contents

- [Choose the owning field](#choose-the-owning-field)
- [Compose variables, scripts, and assets](#compose-variables-scripts-and-assets)
- [Apply late overrides](#apply-late-overrides)
- [Preserve, merge, or remove assets](#preserve-merge-or-remove-assets)
- [Author a reusable preset package](#author-a-reusable-preset-package)
- [Validate a custom preset](#validate-a-custom-preset)

## Choose the owning field

| Need | Put it in |
| --- | --- |
| Shared path or scalar substituted into content | `variables` |
| Task available through `run` | `scripts` |
| File bootstrap should generate | `assets` |
| Change that must apply after the complete inherited stack | `override` |
| Project-only command that intentionally shadows a preset task | local `package.json` |
| Behavior shared by multiple repositories | a custom preset package |

Keep ordinary reusable behavior in the preset stack. Keep only genuine project
differences in the consumer config or local package script.

## Compose variables, scripts, and assets

```typescript
import { preset } from 'presetter';
import esm from '@presetter/preset-esm';

export default preset('@scope/service', {
  extends: [esm],
  variables: {
    source: 'source',
    output: 'dist',
    target: 'ES2024',
  },
  scripts: {
    start: 'node {output}/index.js',
    'schema:check': 'tsx {source}/schema/check.ts',
  },
  assets: {
    '.gitignore': ['/dist', '/coverage'],
    'service.config.json': {
      source: '{source}',
      output: '{output}',
    },
  },
});
```

Definitions merge after earlier `extends` entries. Use this initial pass for new
capability. Use `override` when the change must see and amend the final inherited value.

## Apply late overrides

Plain object overrides deep-merge into inherited content:

```typescript
export default preset('@scope/service', {
  extends: [esm, strict],
  override: {
    variables: {
      output: 'dist',
    },
    scripts: {
      typecheck: 'tsc --noEmit --pretty false',
    },
    assets: {
      'tsconfig.json': {
        compilerOptions: {
          noUncheckedIndexedAccess: false,
        },
      },
    },
  },
});
```

Use a local package script instead when the difference is intentionally private to one
package and should win only at runtime:

```json
{
  "scripts": {
    "build": "vite build",
    "test": "run test --"
  }
}
```

`presetter run build` uses `vite build`; `presetter run build --template` bypasses the
local shadow and exposes the preset task for comparison.

## Preserve, merge, or remove assets

Use a current-value function for arrays or executable configuration whose upstream
content must be retained:

```typescript
import { asset, merge, preset } from 'presetter';

export default preset('@scope/service', {
  extends: [base],
  override: {
    assets: {
      '.gitignore': asset<string[]>((current) => [
        ...(current ?? []),
        '/local-cache',
      ]),
      'vitest.config.ts': asset((current) =>
        merge(current, {
          default: {
            test: { passWithNoTests: true },
          },
        }),
      ),
      '.prettierrc.json': null,
    },
  },
});
```

Return `undefined` from a function for no change and `null` to suppress the asset.
`merge(current, patch)` preserves inherited object structure while applying the patch.
When returning an array or object directly from a function, include every inherited
part that must survive because the function owns its returned value.

## Author a reusable preset package

Create a normal TypeScript package containing checked-in source and templates. Install
the currently compatible packages using the workspace's manager:

```bash
pnpm add @presetter/types @presetter/preset-essentials
pnpm add -D presetter typescript
```

Declare `presetter` as a peer using the compatibility range verified from the installed
CLI/presets, and expose compiled source plus templates:

```json
{
  "name": "@scope/preset-service",
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "exports": {
    ".": {
      "types": "./lib/index.d.ts",
      "default": "./lib/index.js"
    }
  },
  "files": ["lib", "templates"],
  "peerDependencies": {
    "presetter": "workspace:*"
  }
}
```

Replace `workspace:*` with the repository's verified compatible range before publishing
outside that workspace.

```typescript
// src/index.ts
import { resolve } from 'node:path';

import essentials from '@presetter/preset-essentials';
import { preset } from '@presetter/types';

const templates = resolve(import.meta.dirname, '..', 'templates');

export default preset('@scope/preset-service', {
  root: resolve(import.meta.dirname, '..'),
  extends: [essentials],
  variables: {
    source: 'src',
    output: 'lib',
  },
  scripts: {
    start: 'node {output}/index.js',
  },
  assets: {
    'service.config.json': resolve(templates, 'service.config.yaml'),
  },
});
```

Set `root` to the preset package root so binaries supplied by that package resolve when
consumer scripts run. Put tools required by generated/runtime behavior in the package's
appropriate dependency or peer dependency fields.

## Validate a custom preset

Test the definition's default, conditional, function, merge, and null paths. Build the
package, install/link it into a disposable representative consumer, run bootstrap, and
assert generated files and runnable tasks. A generator-unit test alone does not prove
serialization, binary resolution, or consumer package integration.
