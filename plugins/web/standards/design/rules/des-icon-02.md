# DES-ICON-02: Purposeful Animation

## Intent

Animation must explain state changes or hierarchy transitions — never decoration. Motion vocabulary: fade → translate+fade → scale+fade for overlays. Layout stays stable during transitions. Must respect `prefers-reduced-motion`.

## Fix

- Use animation only to communicate: state changes, hierarchy shifts, spatial relationships
- Default motion vocabulary: fade (simplest) → small translate+fade (panels) → tiny scale+fade (overlays/modals)
- Canvas/content area stays stable; only panels/overlays animate
- Same component type uses same motion pattern
- Duration: 150-300ms for micro-interactions, 300-500ms for page transitions
- Add `@media (prefers-reduced-motion: reduce)` to disable or simplify all animations
- No layout jumps — use skeleton placeholders to keep layout stable while loading

## Code Superpowers

- Search for `animation`, `transition`, `@keyframes` — verify each has a communicative purpose
- Check for `prefers-reduced-motion` media query — flag if missing when animations exist
- Look for layout shifts during transitions (elements changing size/position unexpectedly)

## Common Mistakes

1. Decorative animation that distracts from content (bouncing, pulsing, spinning)
2. Layout shifts during transitions (content jumps when panels open/close)
3. No `prefers-reduced-motion` support
4. Inconsistent motion patterns (different animation for same component type)

## Edge Cases

- Loading spinners are functional, not decorative — acceptable
- Marketing/landing page animations may be more expressive than app UI

## Related

DES-ICON-01, DES-STAT-01, DES-BRND-01
