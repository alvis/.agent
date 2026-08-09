# GEN-SCAL-03: Pre-Finalization Risk Check

## Intent

For complex changes, perform a deliberate "what am I missing" pass before finalizing. Explicitly check for blindspots, document key decisions and uncertainties, and assess risk.

## Fix

```typescript
// ✅ GOOD: document key decisions and uncertainties
/**
 * Decision: Using LRU cache with 1-hour TTL
 *
 * Assumptions:
 * - Data changes infrequently (< 1/hour)
 * - Memory is available for cache
 * - Cache misses are acceptable
 *
 * Uncertainties:
 * - Actual data update frequency unknown
 * - Cache memory impact not measured
 *
 * Monitoring: Track cache hit rate, memory usage
 */
```

## Questions to Ask Before Finalizing

- What assumptions am I making?
- What information don't I have?
- What could go wrong that I haven't considered?
- Who else should weigh in?
- What are the unintended consequences?

## Risk Checklist for Complex Changes

```typescript
// ✅ GOOD: explicit risk assessment
// Risk: Migration changes user-facing API
// Rollback: Feature flag allows instant revert
// Monitoring: Alert on error rate > 1% in first 24h
// Dependencies: Requires client SDK v2.1+
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ deploying without risk review, add explicit uncertainty checks before finalizing.
- The checkpoint is a thinking discipline, not a code artifact; but documenting decisions via comments is encouraged for complex areas.

## Related

GEN-SCAL-01, GEN-SCAL-02, GEN-CONS-01
