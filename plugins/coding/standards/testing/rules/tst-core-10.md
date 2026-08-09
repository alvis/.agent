# TST-CORE-10: No Tests Over Static Content

## Intent

A test must exercise behavior. Static content is not behavior: it is a value whose single source of truth already lives somewhere else. A test that re-states that value proves only that two files agree with each other — it fails when someone edits the source and forgets the test, and passes when both are wrong in the same way. That is a change-detector: it taxes every legitimate change to the data while catching no defect.

This applies to static content in any language and any form: constant exports, rosters, manifests, config maps, fixtures-as-truth, and copy text. Asserting it back is the testing analogue of the dead code `GEN-DESN-04` deletes — the fix is deletion, not a test.

## Exception — Systematic Properties

One line separates the two cases:

- **Remove** a test that re-states a specific **value** whose source of truth lives elsewhere.
- **Keep** a test that asserts a **property holding over the set regardless of the values**.

**The operative test — ask what the assertion fails on.** If it fails when the data legitimately changes, it is a change-detector: remove it. If it fails only when the data is genuinely *wrong*, it is a property: keep it. Apply this question first — then check Edge Cases, which settle the shapes where a naive reading of it goes wrong (exact counts, mirrors, generated snapshots, properties over test scaffolding).

The properties below are the common shapes a systematic property takes. They are **illustrative, not exhaustive** — an assertion that matches no row is not a violation for that reason. Put it to the operative test above. (Non-emptiness, idempotence, range invariants, and conservation are all legitimate properties with no row here.)

| Property | Example |
|---|---|
| Bound / cap | body is at most 500 lines |
| Uniqueness | no duplicate rule IDs |
| Ordering | rules sorted by order then ID |
| Referential integrity | every agent has a matching routing row |
| Schema validity | generated frontmatter parses as YAML |
| Cross-source parity | two **independently derived** sources agree — not a hand-maintained mirror (see Edge Cases) |
| Round-trip preservation | serialize → write → read returns the input — a closed loop through the code, not a comparison against a checked-in copy (see Edge Cases) |

## Fix

Apply in order; stop at the first that holds:

1. **Is the property already asserted elsewhere?** Delete the test. Do not replace a mirror with an assertion that duplicates a test the file already has.
2. **Does a systematic property capture what actually matters — i.e. is there a defect the value assertion was standing in for?** Replace the value assertion with the property assertion.
3. **No property, but the content has a consumer?** Delete the test and test the consumer function instead (example below).
4. **No property and no consumer?** The content itself is dead code — delete the content, not only the test (see `GEN-DESN-04`).

Where no property exists and the test's only job was pinning the value, deletion is the whole fix. Do not invent a property to justify keeping the test — an exact count over an unbounded roster stands in for nothing, and there is no cap to assert in its place.

**The matcher does not decide this — the question does.** Four assertions over the same static rule set, all using the same `assertEqual`, split two-and-two:

```python
# ❌ pins a count — the value is static content, and the comment tracks its churn
self.assertEqual(len(self.rules), 30)  # expecting 30 rules post error-assertion-split

# ❌ mirrors the IDs — restates in the test what the source already declares
self.assertEqual({rule.id for rule in self.rules}, self.EXPECTED_IDS)

# ✅ uniqueness — holds for any roster, fails only on a real duplicate
self.assertEqual(len(ids), len(set(ids)))

# ✅ ordering — holds for any roster, fails only on genuine drift
self.assertEqual(keys, sorted(keys))
```

Reading the matcher is not a shortcut to the verdict: `toHaveLength`, `assertEqual`, and `toBeLessThanOrEqual` each appear on both sides of this rule. Hold the data fixed and change only the question asked of it:

```typescript
// ❌ pins the roster's contents — breaks when a role is legitimately added
expect(ROLES).toEqual(["admin", "user"]);

// ✅ same data, a property of it — breaks only on a real duplicate
expect(new Set(ROLES).size).toBe(ROLES.length);
```

If shape correctness matters at compile time, encode it next to the constant — the TypeScript expression of this rule, not the rule itself:

```typescript
const _check = SUPPORTED_MIME_TYPES satisfies ReadonlySet<MimeType>;
```

If callers depend on the constant, test the *consumer* function that uses it instead:

```typescript
describe("fn:validateUpload", () => {
  it("should reject files whose mime type is unsupported", () => {
    expect(() => validateUpload({ mime: "application/x-msdownload" })).toThrow();
  });
});
```

## Edge Cases

- An exact-count assertion over a static set (`toHaveLength(23)`, `assertEqual(23, len(...))`) is a change-detector, not an invariant — the count is itself static content. Assert the property the count was standing in for, or delete it outright when it stood in for nothing.
- **A property over the data itself is legitimate; a property over your own scaffolding is not.** When the static content *is* a deliverable — a shipped manifest, a roster, a config artifact, a field whose length must stay capped — asserting a property over it guards the real thing, and it stays. That the data is static is the point: the cap is a systematic property of the artifact, and no consumer needs to run for it to be evidence. What is pointless is asserting a property over a fixture the test file hand-wrote purely to exercise *other* code: nothing there can fail except the author's own setup, so it tests the scaffolding, not the system. "Fixtures-as-truth" in the Intent means restating fixture *values* — it never forbids properties over data that is itself the product.
- **A mirror is not parity.** Cross-source parity means two sources *derive* the same answer independently (two implementations, a generator against its spec). A hand-maintained list in the test file that someone updates to match the source is a mirror, not a second derivation — it restates the values and is a violation, however much it resembles a parity check.
- **Deleting the assertion can orphan its fixture.** When removing a mirror, the test-local constant it compared against (`EXPECTED_IDS` and similar) usually becomes dead too. Delete it with the assertion; leaving it behind trades a change-detector for dead code (`GEN-DESN-04`).
- **Asserting a function's output message tests the function, not the content.** A test that feeds a consumer an over-long input and asserts it reports an error exercises behavior and is compliant — the message text is an observation of the SUT, not static content restated. Prefer asserting the error structurally over substring-matching its copy, which is brittle for reasons of its own (`TST-DATA-07`).
- A coverage contribution does not redeem a static-content test. Such an assertion executes code and moves the coverage number, so coverage-driven keep/restore logic will protect it; that is a defect in the measurement, not evidence of value. Cover the source through its consumer or a systematic property instead.
- A *generated* constant is tested through its **generator function**, given input and asserted on output. Snapshotting the generated export itself is a violation like any other static-content assertion — the generated file is not a second source of truth.
- Type-level checks (`satisfies`, `as const`) belong in source files, never in `*.spec.ts`.
- A barrel re-export identity assertion (`expect(barrel.UserService).toBe(UserService)`)
  is the same change-detector pathology — it tests the module system, not
  behavior. Barrel files are ignore-marked (`TST-COVR-01`); never write
  re-export tests.

## Related

TST-CORE-04, TST-CORE-05, TST-CORE-07, TST-COVR-04, GEN-DESN-04
