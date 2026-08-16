# Delegated Execution: Compliant Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

## Key Principles

- Delegate for context economy, not ceremony.
- Batch at most about 10 resources per subagent by default and dispatch independent batches together.
- Pause new dispatches while reported issues remain unresolved.
- Keep each mission capsule at or below 4,096 characters with exact paths, constraints, and recursively applicable standards.
- Ask for terse, actionable deltas, require reviews to return `ok` or `blocked` plus at most two lines, and keep structured reports below 1,000 tokens.
- Keep reviews read-only, reconcile every batch report, and bound retries.

## Core Rules Summary

### Batching and Dispatch (DEL-BATC)

- **DEL-BATC-01**: Delegate only when a bounded assignment and report consume less context than direct execution.
- **DEL-BATC-02**: Batch at most about 10 resources per subagent, dispatch independent batches in parallel, and stop new dispatches while issues remain.

### Messages (DEL-MSG)

- **DEL-MSG-01**: Keep every subagent-dispatch and direct teammate-message body within 4,096 characters and include a bounded mission capsule.

### Reports (DEL-REPT)

- **DEL-REPT-01**: Request only actionable fields; reviews return `ok` or `blocked` plus at most two lines, while structured reports stay below 1,000 tokens with semantic boundaries.

### Review (DEL-REVI)

- **DEL-REVI-01**: Reviews are read-only, and the orchestrator decides from the combined batch reports.

### Retries (DEL-RETR)

- **DEL-RETR-01**: Re-dispatch only failed items and normally stop after about two retries per batch.

## Patterns

### Mission Capsule

Give each subagent one bounded mission with exact paths, constraints, expected result, and standards it must read recursively. When the assignment cannot fit within 4,096 characters, put the longer, secret-free instructions in a durable task artifact and send its absolute path plus no more than two summary lines.

### Dispatch Flow

1. Group no more than about 10 related resources per worker.
2. Dispatch independent batches together.
3. Collect all reports before deciding.
4. Stop new dispatches until reported issues are resolved.

### Report Contract

Routine execution reports are terse deltas. Reviews return `ok` or `blocked` plus at most two lines. Detailed evidence belongs in a bounded artifact sent directly to the worker that needs it; the orchestrator receives the verdict and path rather than relayed raw output.

When structured output is required, keep it below 1,000 tokens and wrap it in `<report>...</report>`. Put each hard guardrail in `<IMPORTANT>...</IMPORTANT>` and follow `standard:authoring` for balanced boundaries.

### Batch Decision

- **Proceed**: success or acceptable partial success; continue.
- **Fix**: minor failures; re-dispatch only failed items.
- **Rollback**: critical failure; revert the batch, then re-dispatch.

## Anti-Patterns

- Delegating a task that is cheaper to perform inline.
- Giving a worker broad repository ownership without exact paths.
- Sending independent batches sequentially.
- Relaying noisy logs through the orchestrator.
- Allowing a reviewer to fix the work it judges.
- Repeating the same failed batch without a retry bound.

## Quick Decision Tree

1. Is direct work cheaper in context? Work inline (`DEL-BATC-01`).
2. Can the work be split into batches of about 10 resources? Bound and parallelize independent batches (`DEL-BATC-02`).
3. Does each mission fit within 4,096 characters? Otherwise use a durable artifact (`DEL-MSG-01`).
4. What report fields drive the next decision? Request only those (`DEL-REPT-01`).
5. Are reviewers read-only and all reports reconciled? Choose proceed, fix, or rollback (`DEL-REVI-01`).
6. Has a failed batch already had about two retries? Stop and report the remaining issue (`DEL-RETR-01`).
