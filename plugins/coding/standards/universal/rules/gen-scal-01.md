# GEN-SCAL-01: Profile Before Optimizing

## Intent

Use profiling evidence before introducing optimization complexity. Do not optimize prematurely; measure first and optimize only where evidence shows a bottleneck.

## Fix

```typescript
// ✅ GOOD: profile-driven optimization
const profile = benchmark("invoice-build", () => buildInvoiceSummary(params));
if (profile.p95Ms > 150) optimizeInvoiceSummary();
```

## Avoid Premature Caching

```typescript
// ❌ BAD: optimizing without evidence
const cache = new WeakMap(); // "just in case" it's slow

// ✅ GOOD: measure first, optimize second
// 1. Profile: identified buildReport() takes 200ms at p95
// 2. Added memoization with measured 3x improvement
const reportCache = new Map<string, Report>();
function buildReport(id: string): Report {
  if (reportCache.has(id)) return reportCache.get(id)!;
  const report = computeReport(id);
  reportCache.set(id, report);
  return report;
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ adding caching "just in case", refactor before adding new behavior.
- Choosing appropriate data structures (Map over array scan) is not premature optimization -- it's good design (see `GEN-SCAL-02`).

## Related

GEN-SCAL-02, GEN-SCAL-03, GEN-CONS-01
