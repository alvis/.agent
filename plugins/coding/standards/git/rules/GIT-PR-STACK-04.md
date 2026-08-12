# GIT-PR-STACK-04: Gate Nontrivial Behavior Changes

## Severity

error

## Intent

A behavior change is controlled by a feature flag unless it is simultaneously
green-zone, isolated to one small surface, and reversible by a simple revert
without data implications. The rendered PR message names the flag, default
state, rollout plan, removal target, and cleanup change.

## Scan

Inspect changed execution paths and configuration semantically. Report
nontrivial new behavior that lacks a flag check, or a feature-flag message that
omits its required evidence. A config toggle or kill switch qualifies when it
provides the same controlled rollout and reversal.

## Fix

Add and consume a default-safe feature flag around the changed behavior, then
render its operational evidence through the selected PR message template. Keep
flag ownership in CODEOWNERS or forge assignments rather than the PR body.

```typescript
if (!flags.isEnabled("orders.archive", input.merchantId)) {
  throw new FeatureDisabledError("orders.archive");
}
```

## Edge Cases

- A copy typo in one green, isolated, revertible surface may satisfy the
  exemption; a pricing-engine replacement does not.
- Migrations that expose new behavior require a flag even when the migration
  itself is isolated under `GIT-PR-TYPE-03`.
- Flag retirement removes configuration, telemetry, and tests for both paths.

## Related

GIT-PR-02, GIT-PR-SIZE-01, GIT-PR-SIZE-02, GIT-PR-TYPE-03
