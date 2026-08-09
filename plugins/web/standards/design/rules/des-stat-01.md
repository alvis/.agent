# DES-STAT-01: UI State Coverage

## Intent

Every UI surface must handle all 5 states: loading (skeleton/spinner with stable height), empty (explanation + next step), error (what happened + why + what to do, preserve input), success (confirm outcome + next action), permission (why blocked + how to request access).

## Fix

- **Loading**: skeleton placeholders matching content layout; prevent double-submit; show progress indicator when wait >1s
- **Empty**: explain what "empty" means in context + provide actionable next step (create, import, change filters)
- **Error**: state problem + cause (if safe) + solution; preserve user input; allow retry
- **Success**: confirm what happened + provide next action (view, undo, share)
- **Permission**: explain why access is denied + how to request it

## Code Superpowers

- Search for loading/skeleton/spinner components — flag screens without them
- Check error message patterns — flag generic messages ("Something went wrong")
- Look for empty state handling in list/table components
- Verify form submissions preserve input on error
- **Hover feedback**: for every interactive element, capture computed styles (color, background, borders, outline, box-shadow, text-decoration, transform, opacity, filter, font-weight, letter-spacing, cursor) before and after dispatching a real `hover`; flag **medium** when none of those properties change. Escape with the unhover step (`hover body`) between samples to avoid sticky state.

## Common Mistakes

1. Missing loading state (blank screen while fetching data)
2. Generic error messages without guidance ("Something went wrong")
3. No empty state (blank area with no explanation or next step)
4. Success actions that don't provide a clear next step

## Edge Cases

- Real-time data streams may not have traditional loading states — use connection status instead
- Permission states may not apply to public-facing pages

## Related

DES-STAT-02, DES-COPY-02, DES-HIER-01
