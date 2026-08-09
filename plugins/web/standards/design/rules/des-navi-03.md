# DES-NAVI-03: Current Page Non-Link Affordance

## Intent

The nav/hamburger item representing the page the user is currently on must
(a) be visually distinct from sibling links and
(b) not behave as a link — clicking it should not navigate or reload.

## Fix

- Render the current-page item as a `<span>` or `<button aria-current="page" disabled>`, not `<a href>`
- Apply `aria-current="page"` for assistive tech
- Keep visibly distinct treatment (weight, color, underline, indicator bar) matching DES-NAVI-02
- Apply the same rule inside hamburger/drawer menus and mobile tab bars

## Code Superpowers

- Flag `<a href>` where resolved href === `window.location.pathname`
- Flag nav items missing `aria-current="page"` when matching the current route
- Flag identical visual treatment between current and non-current items

## Common Mistakes

1. Current page is still a clickable `<a>` that reloads the page
2. `aria-current` missing → screen readers cannot tell which item is active
3. Active state uses only color (color-blind users)
4. Hamburger menu shows current page as a normal link

## Edge Cases

- Single-page apps with hash routing: compare `location.hash` as well
- "Home" logo link is allowed to remain a link on the home page (convention)
- Sticky/sub-nav with in-page scroll anchors may keep links for scrolling

## Related

DES-NAVI-02, DES-A11Y-01, DES-STAT-02
