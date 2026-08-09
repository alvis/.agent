# DOC-LIFE-03: Stable Documentation Tags

## Intent

Persistent tags (`NOTE`, `IMPORTANT`, `WARNING`, `SECURITY`, `PERFORMANCE`, `COMPATIBILITY`, `LIMITATION`, `HACK`, `WORKAROUND`) may remain only when they add long-term operational value. Use tags sparingly and avoid repeated visual-noise tag spam.

## Fix

```typescript
// NOTE: skip root tsconfig to avoid circular refs
import { config } from "./local.config";
```

```typescript
// WARNING:
// this mutation is intentional for performance
// do not refactor to immutable without benchmarking
mutateInPlace(buffer);
```

```typescript
// IMPORTANT: all amounts must be in cents to avoid floating-point errors
const total = items.reduce((sum, item) => sum + item.priceInCents, 0);

// SECURITY: sanitize before rendering to prevent stored XSS
const safe = sanitizeHtml(userContent);

// COMPATIBILITY: IE11 does not support ResizeObserver
const observer = window.ResizeObserver ? new ResizeObserver(cb) : fallback(cb);

// HACK: workaround for library bug - remove when upstream fixes #4521
const result = patchedParse(input);
```

## Persistent Tags Reference

These tags can stay in production code when they add long-term value:

| Tag | Purpose |
|-----|---------|
| `NOTE` | important context or non-obvious explanation |
| `IMPORTANT` | highlights critical constraints or requirements |
| `WARNING` | alerts about potential risks or edge cases |
| `SECURITY` | documents security implications |
| `PERFORMANCE` | highlights optimization context |
| `COMPATIBILITY` | handles browser/platform specific issues |
| `LIMITATION` | documents known limitation |
| `HACK` | workaround for library bug (reference upstream issue) |
| `WORKAROUND` | bypass for third-party API issue |

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `// NOTE NOTE NOTE`, consolidate to a single tag instance.
- If a persistent tag carries no long-term value, remove it and keep plain code.
- `LIMITATION` documents known constraints that consumers should be aware of.
- `WORKAROUND` should reference the upstream issue when possible.

## Related

DOC-LIFE-01, DOC-LIFE-02, DOC-LIFE-04
