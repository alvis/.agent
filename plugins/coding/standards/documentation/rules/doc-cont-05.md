# DOC-CONT-05: No Standard Rule IDs in Comments

## Intent

Source-code comments must not reference standard rule IDs (`DOC-FORM-03`,
`TYP-IMPT-07`, `RPS-LAYOUT-01`) or group prefixes (`TST-STRU`, `RC-DOC`).
Rule IDs are scaffolding for the standards system — lookup keys in rule
files, lint reports, and PR review prose — not explanations of WHY the
code is shaped a certain way. Comments must describe intent in their
own terms.

## Fix

Replace the rule reference with the underlying reason:

```typescript
// ❌ BAD: leaks tooling vocabulary into the source file
// ensure first letter is lowercase per DOC-FORM-03
const summary = lowercaseFirst(text);

// ✅ GOOD: state the intent
// JSDoc summaries are sentence fragments that read together with the type signature
const summary = lowercaseFirst(text);
```

## Allowed Cases

The advisory scanner flags every match; humans triage. Permitted exceptions
(not auto-suppressed):

- **Standards-enforcement tooling** — audit/lint scripts whose code section
  literally implements the named rule may annotate the section in a header
  comment (e.g., `// ---- Color collection (DES-CONS-01) ----` in
  `plugins/web/skills/audit/scripts/design-tokens-audit.js`). The rule ID
  identifies the artifact under test, not the reason for the code.

## Edge Cases

- Section headers like `// --- IDENTIFIERS --- //` are governed by
  `DOC-FORM-06`, not this rule, even though the token shape superficially
  resembles a rule ID.
- String literals embedding a rule ID (e.g., `const id = "TST-STRU-01"`)
  are not comments and are not in scope.
- TODO/REVIEW tags pinned to a rule (`// TODO: align with TYP-IMPT-07`) are
  governed by `DOC-LIFE-01` / `DOC-LIFE-02` — remove the tag first; the
  rule-ID violation falls out automatically.

## Related

DOC-CONT-01, DOC-CONT-03, DOC-FORM-06, DOC-LIFE-01
