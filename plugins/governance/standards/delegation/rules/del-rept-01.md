# DEL-REPT-01: Return Actionable Reports

Request only fields the orchestrator will act on. Routine reports are terse deltas, and reviews return `ok` or `blocked` plus at most two lines; do not relay raw command output through the orchestration layer. Put detailed evidence in a bounded artifact sent directly to the worker that needs it.

Structured reports stay below 1,000 tokens inside `<report>...</report>`. Hard guardrails use `<IMPORTANT>...</IMPORTANT>` according to `standard:authoring`.
