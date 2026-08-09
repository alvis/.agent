# Delegated Execution: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

Any single violation blocks submission by default.
If a violation is detected, load the matching rule guide at `./rules/<lowercase-rule-id>.md`.

## Quick Scan

- DO NOT delegate work whose assignment and report would consume at least as much context as direct execution [`DEL-BATC-01`]
- DO NOT give one subagent more than about 10 resources by default, serialize independent batches, or continue dispatching while reported issues remain unresolved [`DEL-BATC-02`]
- DO NOT send an `Agent`, `Task`, or `SendMessage` body over 4,096 characters or omit exact scope, constraints, and recursively applicable standards [`DEL-MSG-01`]
- DO NOT relay raw command output, request fields the orchestrator will not act on, exceed 1,000 tokens in a structured report, or return a review outside `ok`/`blocked` plus at most two lines [`DEL-REPT-01`]
- DO NOT let a review subagent modify resources or make a batch decision without reconciling the combined reports [`DEL-REVI-01`]
- DO NOT retry a failed batch indefinitely; normally stop after about two targeted retries and report what remains [`DEL-RETR-01`]

## Rule Matrix

| Rule ID | Violation | Bad Examples |
|---|---|---|
| `DEL-BATC-01` | Context-wasteful delegation | Dispatching a one-line edit; reading a noisy repository sweep inline |
| `DEL-BATC-02` | Unbounded or unsafe dispatch | 30 resources for one worker; dispatching more while a P1 remains open |
| `DEL-MSG-01` | Oversized or incomplete mission | A 6,000-character `Task` body; scope without exact paths |
| `DEL-REPT-01` | Non-actionable report | Full test logs; a 2,000-token structured summary; a free-form review essay |
| `DEL-REVI-01` | Mutating or unreconciled review | Reviewer edits code; orchestrator ignores one batch report |
| `DEL-RETR-01` | Unbounded retry loop | Re-dispatching the same failed batch until the session ends |
