# DES-ICON-01: Icon Consistency

## Intent

Single icon family throughout (Lucide, Material Symbols, or SF Symbols — pick one variant). No emoji as UI icons. Standardized sizes: 16/20/24px. Icon-only reserved for universally-known actions (search/close/more/settings). Ambiguous icons get text labels.

## Fix

- Choose one icon set and use it exclusively: Lucide (web), Material Symbols outlined OR rounded (pick one), or SF Symbols (Apple)
- Standardize icon sizes: 16px (inline), 20px (buttons), 24px (navigation)
- Same stroke weight (outline) or fill style (filled) throughout — never mix
- Icon-only buttons reserved for: search (magnifier), close (x), more (kebab/ellipsis), settings (gear), back (arrow)
- All other icons must include a text label
- Tooltip support only — never the primary way to understand an action

## Code Superpowers

- Extract icon usage — flag if multiple icon families imported
- Check icon-only buttons for `aria-label` and whether action is universally understood
- Verify icon sizes follow standardized values (16/20/24)
- Search for emoji characters in UI components — flag all

## Common Mistakes

1. Mixed icon styles (some outlined, some filled, some emoji)
2. Icon-only buttons for non-universal actions (users don't know what they do)
3. Random icon sizes per screen (18px, 22px, 26px)
4. Emoji used as UI icons or decoration

## Edge Cases

- Flags/country indicators may use emoji — acceptable for non-interactive display
- Brand logos are not icons and may differ from the icon set

## Related

DES-ICON-02, DES-A11Y-02, DES-CONS-01
