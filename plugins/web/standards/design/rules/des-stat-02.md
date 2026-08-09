# DES-STAT-02: Interactive States

## Intent

Every interactive element must have hover, active, disabled, and focus visual states. Disabled controls must explain why they're disabled. No interactive element should lack visual feedback.

## Fix

- **Hover**: subtle background/color shift confirming interactivity
- **Active/Pressed**: slightly darker or inset treatment confirming click registered
- **Focus**: visible outline (2px solid, offset) for keyboard navigation
- **Disabled**: reduced opacity (0.5), `cursor: not-allowed`, with tooltip or adjacent text explaining why
- **Loading**: spinner/skeleton replacing content during async action

## Code Superpowers

- Look for `:hover`, `:active`, `:disabled`, `:focus` / `:focus-visible` pseudo-classes on interactive elements
- Flag buttons/links missing any of the four required pseudo-states
- Check disabled elements for explanatory text or tooltip

## Common Mistakes

1. No hover state on clickable elements (no visual feedback)
2. Disabled buttons without explanation of why they're disabled
3. Missing active/pressed state (click feels unresponsive)
4. Focus styles only on some elements, not all

## Edge Cases

- Touch devices don't have hover — ensure active state provides sufficient feedback
- Some custom components may use JS-driven states instead of CSS pseudo-classes

## Related

DES-STAT-01, DES-A11Y-01, DES-HIER-02
