---
name: complete-test
description: Author and improve tests for pending test cases, coverage gaps, fixtures, and redundancy cleanup. Use for test TODOs, it.todo or describe.todo entries, explicit test-writing requests, or coverage work. Production implementation stubs belong to complete-code; diagnosed failures belong to fix.
model: opus
argument-hint: "[scope] [--coverage=<percent>] [--framework=<name>]"
---

# Complete test

Own test authoring and test-suite maintenance. Do not implement production behavior, rewrite a failing application fix, or create placeholders for unspecified features.

## Boundaries

- Use for: pending test markers, coverage gaps, fixture restructuring, and test-suite redundancy cleanup within the requested scope.
- Do not use for: `FIXME` markers and production failures (`coding:fix`), production stubs (`coding:complete-code`), or new behavior without a testable contract (`coding:write-code`).

## Inputs

- Required: scope — files, package, feature, or explicit pending-test marker.
- Optional: coverage target (default: 100% statements, branches, functions, and lines unless an explicit repository policy sets another target), framework, and existing test paths.
- Prerequisites: read project test scripts/configuration and the source under test before editing.

## State gate

Before creating or materially rewriting a project artifact, read the absolute
`state.md` path injected by Essential. If unavailable, stop artifact
writes and report the missing contract. Resolve the active work root first.
When delegated, start from the mission capsule's exact work root and relevant
specification, review, and evidence paths. Read `state/working.md` only when the
capsule lacks current navigation; read `state.md` only for resume, cross-slice
dependency, or alignment work. Never write PM-owned work pointers or overviews.
The caller/PM uses the resolver, asks only on `work_id_required`, and gives a
delegated run the explicit resolved work ID/root.

## Workflow

Load [references/orchestration.md](references/orchestration.md) for the full coordination procedure: batching algorithm, subagent dispatch prompts, the per-test coverage-verification loop, redundancy-removal phases, fixture-restructuring phases, and report shapes.

1. Resolve scope and repository-native test/coverage commands. Inventory each source file, current tests, pending markers, fixture ownership, and configured exclusions. Capture per-source and aggregate coverage before editing.
2. Partition independent source/test pairs into coherent batches: 2-5 source files and at most 500 source lines per batch, dispatched at most 8 in parallel; re-batch and retry any incomplete batch. Parallelize only disjoint files and fixtures; serialize shared fixtures, global setup, snapshots, and integration state. Record the batch-to-file map so no source is skipped.
3. For every proposed case apply **test → measure → keep**: add the smallest test, run its focused suite, measure the intended source/branch, and keep it only when it adds behavioral evidence or coverage. Delete tests that merely restate another assertion. A static-content assertion is never kept on coverage alone: restating a value whose source of truth lives elsewhere is a change-detector, so assert the systematic property or test the consumer instead (`TST-CORE-10`).
4. Cover happy paths, meaningful boundaries, failures, and integration seams until every selected source reaches 100% or the repository's explicit policy threshold. Report uncovered lines/branches per source; aggregate coverage cannot conceal a weak file.
5. Plan fixtures before changing them: identify consumers, lifecycle, mutation, and migration order. For a fixture rewrite, migrate every consumer, run focused suites, then the full suite. Do not leave old and new fixture systems in parallel.
6. Test redundancy cleanup by remove → measure → restore: remove one candidate, rerun focused tests and coverage, keep it removed only if signal and coverage are unchanged; otherwise restore it. Scope the coverage check to the test's mirrored source file: a test that contributes to its own source file's coverage stays even when globally redundant, and a test verifying a distinct behavior stays even when it covers the same lines as another. Never infer redundancy from similar prose alone; remove least-risky candidates first. Static-content assertions are the exception to the measurement: they are removed on the rule (`TST-CORE-10`), not on the coverage delta.
7. After each batch, run focused tests and coverage. If production behavior is wrong, route to `coding:fix`; do not edit source here. After all batches, run the complete repository test, coverage, type, and lint gates that apply.
8. Request one independent final test review covering missing behavior, weak assertions, fixture correctness, nondeterminism, and per-source coverage. Apply justified test-only corrections and rerun the affected and full gates. When a gate fails, fix the cause and re-run that gate; repeat until every gate passes or a concrete blocker remains, then report the blocker instead of looping.

## Verification

Require passing focused and full suites, coverage at the requested target (or a cited repository policy/technical limitation), and no remaining owned pending markers. Report batches, files/cases added and removed, fixture migrations, focused/full commands, independent-review result, aggregate metrics, and per-source statements/branches/functions/lines. Name every justified gap.

## Completion

Return a concise test report. Do not claim production implementation, bug fixes, or coverage for code outside the selected scope.
Return every created or materially rewritten path as `generated_files` to the
PM. Do not run file sizing; after all artifact writers finish, the PM checks
only eligible work Markdown inside the target `.state/`.
