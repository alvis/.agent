# DEL-BATC-01: Delegate for Context Economy

Delegate only when direct execution would consume more session context than briefing a bounded assignment and reading its report. Bulk file reads, noisy command output, and transformations over independent resources are good candidates; small work stays inline.

Delegation that saves no context adds latency and failure modes without improving the result.
