# WT-TAILWIND-02: CSS Import Order Is Fixed

## Intent

The variable cascade depends on a strict CSS import order in client apps: the library's stylesheet declares the `@theme` contract and component CSS FIRST, the client's `theme.css` overrides tokens under `[data-brand="…"]` SECOND, and any app-level CSS (page layouts, route-specific styles) loads LAST. Reversing this order means a client override arrives before the contract it is overriding — the override has no target, and the cascade silently keeps the library defaults.

## Fix

- Import `@company/ui/styles.css` (or the equivalent library bundle) as the first CSS import in the client app entry
- Import client `theme.css` immediately after the library stylesheet
- Import any app-level CSS (page layouts, feature-specific styles) last
- Enforce the order in the entrypoint file (`app/layout.tsx`, `app.tsx`, `main.tsx`) — never spread imports across multiple modules where order becomes implicit

```typescript
// ❌ BAD: client theme before library — overrides have nothing to override
import './theme.css';
import '@company/ui/styles.css';

// ❌ BAD: app CSS before client theme — app may rely on tokens that haven't been overridden yet
import '@company/ui/styles.css';
import './app.css';
import './theme.css';

// ✅ GOOD: library → client theme → app
// apps/acme/src/app/layout.tsx
import '@company/ui/styles.css';
import './theme.css';
import './app.css';
```

## Code Superpowers

- Grep the client app's entry file(s) for CSS imports and confirm the order: library bundle FIRST, client `theme.css` SECOND, app CSS LAST
- Confirm there is exactly one CSS import for the library bundle (avoid double imports across entries)
- In a Next.js app, confirm `app/layout.tsx` owns the imports — not individual route files, where order is per-page and unpredictable

## Common Mistakes

1. Re-ordering imports alphabetically with a formatter that does not respect side-effect import order
2. Splitting library and theme imports across `app/layout.tsx` and a separate provider file, where bundler order becomes implicit
3. Importing `theme.css` lazily inside a component, after the library has already painted with default values
4. Adding a new app-level CSS file at the top of the import list "for convenience"

## Edge Cases

- CSS-in-JS solutions that inject styles at runtime follow the same conceptual order — library styles must register before client overrides
- Storybook configurations need the same import order in `preview.ts`/`preview.tsx` for stories to reflect the client theme accurately
- Module federation / remote-loaded styles must coordinate order via a manifest; otherwise the cascade is non-deterministic

## Related

WT-TAILWIND-01, WT-CONTRACT-01
