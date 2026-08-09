# DES-NAVI-02: Location Indication

## Intent

Users must always know where they are within the application. Current location clearly indicated via breadcrumbs, active navigation highlights, and stable navigation elements. Breadcrumbs or back navigation for hierarchies deeper than 2 levels.

## Fix

- Highlight active navigation item with distinct visual treatment (background, border, color change)
- Add breadcrumbs for hierarchies >2 levels deep
- Ensure back navigation is always available in sub-pages
- Keep navigation position and structure stable during page transitions
- Use page titles that match the navigation label

## Code Superpowers

- Check navigation elements for active/current state styling (`.active`, `aria-current`)
- Verify breadcrumb presence on pages >2 levels deep
- Compare page titles against navigation labels for consistency

## Common Mistakes

1. No active indicator in sidebar/tabs (user doesn't know which page they're on)
2. Missing breadcrumbs in deep hierarchies (user loses context)
3. Page titles that don't match navigation labels
4. Navigation that shifts or disappears during transitions

## Edge Cases

- Single-page applications may use URL hash or state-based indicators instead of traditional breadcrumbs
- Full-screen immersive experiences (media players, editors) may hide navigation intentionally

## Related

DES-NAVI-01, DES-CONS-02, DES-COPY-01
