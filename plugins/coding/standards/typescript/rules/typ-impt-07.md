# TYP-IMPT-07: No Dynamic Import With Static Path

## Intent

Use static `import ... from '...'` statements for known module paths. Dynamic `import()` is only permitted when the path is computed at runtime (variable, function argument, interpolated template, etc.). Statically-known dynamic imports defeat tree-shaking, type-checking, and bundler analysis without providing any benefit dynamic import was designed for. The same applies in type position: `type X = typeof import('./foo')` and `type X = import('./foo').Bar` should use a static `import type { Bar } from './foo'` instead.

## Fix

```typescript
// static import for a statically-known path
import foo from './foo';
```

### Allowed Cases

Dynamic `import()` is reserved for paths that are genuinely computed at runtime.

```typescript
// plugin/module loading from config — path is runtime-resolved
const plugin = await import(pluginPath);

// per-locale resource — interpolated template literal
const messages = await import(`./locales/${locale}.json`);

// conditional polyfill — module is only loaded when the runtime check fails
if (needsPolyfill) {
  await import('./polyfill');
}

// vi.mock / vi.hoist — Vitest hoists these above static imports, so referencing
// the original module type via `typeof import(...)` is the only ergonomic option
vi.mock('execa', async () => {
  const actual = await vi.importActual<typeof import('execa')>('execa');
  return { ...actual, execa: vi.fn() };
});
```

### Bad Examples

```typescript
// ❌ string literal — use a static import
const mod = await import('./utils');

// ❌ template literal with no interpolation — equivalent to a string literal
import(`./constants`).then((m) => m.run());

// ❌ relative literal — bypasses static analysis for no benefit
const { x } = await import('../config');

// ❌ type-position dynamic import with static path — use `import type` instead
type ExecaModule = typeof import('execa');

// ❌ type extraction via dynamic import — use `import type { Bar } from './foo'`
type Bar = import('./foo').Bar;
```

## Related

TYP-IMPT-01, TYP-IMPT-02
