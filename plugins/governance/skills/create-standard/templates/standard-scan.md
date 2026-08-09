# [Standard Title]: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

<!-- INSTRUCTION: This file is the violation detection tier — used during code review and linting -->
<!-- INSTRUCTION: Every item must reference a rule ID from the rule groups defined in meta.md -->
<!-- INSTRUCTION: Keep descriptions concise but specific enough to detect violations unambiguously -->

Any single violation blocks submission by default.
If a violation is detected, load the matching rule guide at `./rules/<rule-id>.md`.

## Quick Scan

<!-- INSTRUCTION: List every rule as a "DO NOT" statement ending with the rule ID in brackets -->
<!-- INSTRUCTION: Group related rules together (follow the rule group order from meta.md) -->
<!-- INSTRUCTION: Each line should be specific enough that a reviewer can spot the violation in code -->

- DO NOT [violation description for rule 1] [`PFX-GRP1-01`]
- DO NOT [violation description for rule 2] [`PFX-GRP1-02`]
- DO NOT [violation description for rule 3] [`PFX-GRP2-01`]

## Rule Matrix

<!-- INSTRUCTION: One row per rule — keep Bad Examples as short inline code snippets -->
<!-- INSTRUCTION: The Violation column should be a brief noun phrase (not a sentence) -->

| Rule ID | Violation | Bad Examples |
|---|---|---|
| `PFX-GRP1-01` | [Brief violation description] | `[bad code snippet]`; `[another bad snippet]` |
| `PFX-GRP1-02` | [Brief violation description] | `[bad code snippet]` |
| `PFX-GRP2-01` | [Brief violation description] | `[bad code snippet]` |
