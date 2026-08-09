# DES-SPAC-02: Proximity-Based Grouping

## Intent

Related items must be closer together than unrelated items. Spacing communicates relationships — the proximity principle must be actively applied so users can parse visual groups without labels.

## Fix

- Use smaller spacing within groups (--space-2 to --space-4) and larger spacing between groups (--space-6 to --space-8)
- Ensure the ratio between intra-group and inter-group spacing is at least 2:1
- Group form fields by meaning with section headings
- Place controls near what they affect (mapping principle)

## Code Superpowers

- Compare spacing between related vs unrelated elements — flag if gap ratio is <1.5:1
- Check form field grouping — related fields should have smaller gaps than field groups
- Verify section separators use distinctly larger spacing than element gaps

## Common Mistakes

1. Related items have the same spacing as unrelated groups (everything 16px)
2. Insufficient separation between logical sections
3. Form fields with uniform spacing regardless of semantic grouping
4. Controls placed far from the content they affect

## Edge Cases

- Dense data tables may use minimal spacing throughout — acceptable if row/column structure provides grouping
- Mobile layouts may compress spacing but should maintain the relative ratio

## Related

DES-SPAC-01, DES-NAVI-01, DES-HIER-01
