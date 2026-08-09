# GEN-DESN-04: Eliminate Dead Code

## Intent

A symbol with no consumer is dead code and MUST be removed — not retained,
commented out, or tested. This covers unreferenced constants, regexps, types,
interfaces, functions, and unreachable statements. Dead code inflates the
surface a reader must hold, drifts out of sync with real behavior, and tempts
change-detector tests that assert its shape only to keep coverage green. The
fix for dead code is always deletion, never a test.

A symbol is dead when nothing in the codebase references it. A symbol
re-exported from the package's declared public entry point (`package.json`
`exports`/`main`) is NOT dead even with zero in-repo consumers — its
consumers are external.

## Fix

```typescript
// ❌ BAD: exported regexp no function ever consumes
export const INLINE_PATTERNS = /(\*\*|__|~~)/g;

// ❌ BAD: constant asserted by a test but read by no production code
export const logo = "███ ACME";

// ✅ GOOD: delete the unreferenced symbol entirely
```

If shape correctness of a *live* constant matters, encode it at compile time
next to the constant (`satisfies`, `as const`) — see `TST-CORE-10`. If the
symbol has a consumer it is not dead; keep it and test the consumer.

## Detection

Dead-code detection is two-phase — a fast mechanical pass narrows the field,
then a review team verifies each hit:

1. **Quick mechanical pre-scan** — run `fallow` (codebase intelligence for
   TypeScript/JavaScript) to surface candidates:

   ```bash
   fallow dead-code --production       # unused files, exports, deps
   fallow dead-code --unused-exports   # narrow to unused exports only
   ```

   If the project already has a `.fallowrc.json`, honor it; if it does not,
   do NOT create one — run with CLI flags (`--production` is the key flag).

2. **Agentic deep-dive** — an agentic review team investigates every
   candidate case by case before any deletion. fallow output is a list of
   CANDIDATES, never a delete list.

<IMPORTANT>
A misconfigured fallow run false-positives — most often test code flagged as
dead because test files, fixtures, and helpers are not exported by nature.
NEVER bulk-delete from a fallow report. For each reported symbol the review
team MUST confirm: zero consumers, not a declared public-API entry, and not a
test/fixture reachable only by a spec. Always run with `--production` to
scope away test code; only tune `.fallowrc.json` when the project already
maintains one — never create one solely for a dead-code sweep.
</IMPORTANT>

## Edge Cases

- **Declared public API** — a symbol re-exported from the package's public
  entry point is kept even with no in-repo consumer; external packages are
  its consumers.
- **Generated code** — a symbol emitted by a build step and consumed only by
  generated output is governed by its generator, not this rule.
- **Commented-out code** — dead code parked in comments is covered by
  `DOC-CONT-03`; delete it.
- **No-value wrappers** — a function that exists but adds nothing is governed
  by `FUNC-ARCH-03`; the remedy is likewise deletion.

## Related

GEN-DESN-01, GEN-DESN-02, GEN-DESN-03, FUNC-ARCH-03, DOC-CONT-03, TST-CORE-10
