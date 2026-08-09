# AUT-DELG-01: Delegate for Context Economy

Delegate when direct execution would consume more session context than a bounded assignment and report, such as bulk file reads, noisy command output, or independent resource transformations. Keep small work inline because delegation that saves no context adds latency and failure modes.

Whenever an artifact dispatches subagents, apply the complete `standard:delegation` contract at the dispatch step.
