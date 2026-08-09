# RC-NEXT-01: Next.js Performance Primitives

## Intent

Use Next.js's built-in primitives for code-splitting and image optimization: `dynamic()` for heavy or optional components, and `next/image` for content images.

## Fix

- Replace static `import HeavyChart from '...'` with `dynamic(() => import('...'))` when the component is large or below-the-fold
- Provide a `loading` fallback (`<Skeleton />`) and set `ssr: false` for client-only widgets
- Replace `<img>` with `<Image>` from `next/image`, supplying `width`, `height`, `alt`, and `priority` for LCP images

```typescript
// ✅ GOOD: dynamic imports for performance
const HeavyChart = dynamic(() => import('#components/Chart'), {
  loading: () => <Skeleton />,
  ssr: false,
});

// ✅ GOOD: optimized images
<Image
  src="/hero.jpg"
  alt="Description"
  width={1200}
  height={600}
  priority
/>
```

## Code Superpowers

- Grep for `<img ` in `app/` and `components/`; flag any not coming from `next/image`
- Identify heavy chart/editor/map imports done statically and recommend `dynamic`
- Verify above-the-fold images use `priority`

## Common Mistakes

1. Static-importing rich-text editors or charting libraries (causes large initial bundles)
2. Using `<img>` because "it works" — loses optimization, sizing, and lazy loading
3. Setting `priority` on every image (defeats prioritization)

## Edge Cases

- SVG icons via inline components don't need `next/image`
- Externally hosted images may need `remotePatterns` configuration

## Related

RC-PERF-02
