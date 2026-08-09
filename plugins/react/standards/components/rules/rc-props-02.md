# RC-PROPS-02: Composition Over Configuration

## Intent

Favor compound component composition (`<Card><Card.Header>...</Card.Header></Card>`) over piling on configuration props (`showHeader`, `headerStyle`, `headerTitle`). Composition makes intent explicit and keeps each piece reusable.

## Fix

- Identify props that toggle whole subsections (`showX`, `enableY`) and replace with sub-components or `children`
- Expose compound parts as static properties: `Card.Header`, `Card.Body`, `Card.Footer`
- Pass content via `children` rather than string props when markup variation is likely

```typescript
// ✅ GOOD: composable structure
<Card>
  <Card.Header>
    <Card.Title>Profile</Card.Title>
  </Card.Header>
  <Card.Body>
    <UserInfo user={user} />
  </Card.Body>
</Card>

// ❌ BAD: too many props
<UserCard
  title="Profile"
  showHeader={true}
  headerStyle="primary"
  user={user}
  ...
/>
```

## Code Superpowers

- Flag components with >5 boolean toggle props (likely candidates for compound components)
- Flag components that render different subtrees based on `showX` props instead of `children`

## Common Mistakes

1. Adding `headerTitle` / `footerText` props instead of `<X.Header>` / `<X.Footer>` slots
2. Booleans like `withIcon`, `withLabel` that gate large subtrees
3. Duplicating layout logic across many `<Card>` variants instead of composing them

## Edge Cases

- Tightly controlled design-system primitives (e.g. `<Button variant="primary">`) are fine with prop-based variants

## Related

RC-PROPS-01
