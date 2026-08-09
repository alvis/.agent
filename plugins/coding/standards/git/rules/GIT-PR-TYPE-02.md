# GIT-PR-TYPE-02: Code Spec and Scaffolding Land First

## Severity

error

## Intent

In any stack, the `code-spec` (types, interfaces, schemas, JSDoc-only contracts) and any required scaffolding land **before** their `implementation`. Spec-first stacking lets reviewers settle the shape of an API in isolation and lets downstream PRs reference settled types instead of inventing them mid-diff.

## Fix

Stack layout for a new `archiveOrder` operation:

```text
auth-rewrite/01-spec        feat(orders): add archive types
auth-rewrite/02-impl        feat(orders): add archiveOrder
auth-rewrite/03-integration feat(orders): wire archive to API
```

Inside the spec PR — types only, no runtime behaviour:

```typescript
// orders/archive-types.ts
export interface ArchiveOrderInput {
  readonly orderId: OrderId;
  readonly reason: ArchiveReason;
}

export type ArchiveReason = "fulfilled" | "cancelled" | "expired";
```

The implementation PR then imports and fulfils these types; reviewers compare its diff against an already-merged contract.

### Why this matters

- Types are the cheapest review surface; settling them first prevents API thrash mid-implementation.
- Reviewers of the implementation PR can trust the type shape without re-reviewing it.
- Spec-only PRs almost always fit in the green zone (`GIT-PR-SIZE-01`), keeping turnaround fast.

## Edge Cases

- For tiny features where spec + impl together stay green, a single PR is acceptable. The spec-first rule applies whenever the combined PR would exceed green.
- Inferable internal types do not count as "spec" — only types that cross module or service boundaries need a dedicated spec PR.
- A `contract` PR (external/wire) follows the same rule with stricter review (producer + consumer owners).

## Related

GIT-PR-TYPE-01, GIT-PR-TYPE-03, GIT-PR-TYPE-04, GIT-PR-SIZE-01, GIT-PR-STACK-01, GIT-PR-STACK-05
