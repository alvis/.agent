# DES-NAVI-01: User Mental Model IA

## Intent

Navigation must be organized by user mental model (goal/object/time/status), not by backend structure or technical implementation. Search/filter/sort available when item count exceeds ~7 (Hick's Law). Navigation patterns stable across similar screens.

## Fix

- Group navigation items by user goals or objects, not database tables
- Limit visible choices to ~7 top-level items; group additional items under categories
- Add search when navigating >7 items; add filter/sort for lists
- Use consistent navigation patterns across similar screen types
- Use smart defaults to eliminate unnecessary decisions

## Code Superpowers

- Count top-level navigation items — flag if >7
- Check for search/filter components on list/table views
- Compare navigation structure across similar page types for consistency

## Common Mistakes

1. Navigation organized by technical structure (API endpoints, database tables)
2. >10 top-level navigation items without grouping
3. No search/filter when lists grow large
4. Inconsistent navigation patterns between similar pages

## Edge Cases

- Developer tools may use technical terminology in navigation by necessity
- Admin panels may mirror data structure when admins think in those terms

## Related

DES-NAVI-02, DES-COPY-01, DES-HIER-01
