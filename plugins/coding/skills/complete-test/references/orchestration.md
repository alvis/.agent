# Complete-Test Orchestration — batches, dispatch prompts, and reports

Referenced from SKILL.md. You are the orchestrator: drive the workflow end-to-end through fire-and-forget subagent dispatch with structured task-tracking status, dispatching a maximum of **8 parallel subagents** at any time. After each sub-step, aggregate the returned reports before moving on. Every dispatch is a mission capsule naming the exact scope, expected result, standards to read (`testing/meta.md` + `testing/write.md`, `typescript/write.md`, `documentation/write.md`), active work root, and only the relevant contract/evidence paths. Children do not reread broad work journals unless the assignment is a resume or cross-slice alignment task; they never write PM-owned pointers/overviews or delegate further. Every writer returns explicit `generated_files` to the PM.

## Sub-step 1 — Initial coverage analysis (single subagent)

Discover existing test files with filesystem pattern search (`**/*.spec.{ts,tsx}`, `**/*.test.{ts,tsx}` — never `find` in bash). Dispatch one Coverage Analysis subagent to:

1. **Discover test configuration**: locate `vitest.config.ts` or equivalent, verify the coverage provider (v8), check excluded patterns.
2. **Run existing tests** and note any failures.
3. **Generate a coverage report** (`npm run coverage` / `vitest --coverage`) and extract line, branch, statement, and function coverage.
4. **Identify uncovered code**: fully uncovered files, and for partially covered files the uncovered line ranges, branches, and functions.
5. **Report baseline metrics**: overall and per-file percentages, `uncovered_files`, `partially_covered_files`, existing test count, failing tests.

Verify the baseline is present and accurate before planning batches from it.

## Sub-step 2 — Progressive test writing (parallel batches)

Each subagent owns 2–5 source files (max 500 source lines per batch) and writes tests ONE at a time, verifying coverage after each and deleting tests that don't improve it.

**Batching algorithm**: start with the first uncovered file, add files until 5 files OR 500 lines is reached, create the batch, repeat until all files are assigned. Example:

```
Source files: auth/service.ts (120), auth/controller.ts (180), users/service.ts (150),
              users/controller.ts (200), posts/service.ts (100), posts/controller.ts (300)
Batches:      1: auth/service, auth/controller, users/service   (450 lines, 3 files)
              2: users/controller, posts/service                (300 lines, 2 files)
              3: posts/controller                               (300 lines, 1 file)
```

Record the batch-to-file map in structured task-tracking capability (one todo per batch) so no source file is skipped. Dispatch all batches in a single message, at most 8 concurrent. Each batch subagent runs this loop **for each source file**:

1. **Initial coverage check**: `vitest --coverage <spec path>`; note current coverage and the first uncovered line/branch.
2. **Progressive writing loop** (repeat until 100%):
   a. Write ONE test targeting a specific uncovered line/branch (AAA pattern, proper types, per standards).
   b. Re-run the focused coverage command and parse the new numbers.
   c. Decide: coverage increased (even by 1 line) → KEEP and move to the next uncovered target; coverage unchanged → DELETE the test immediately and write a different one.
   d. 100% reached → next file in the batch; otherwise repeat from (a).
3. **Batch completion verification**: run coverage for all the batch's test files together; verify every source file is at target; count tests created vs deleted.
4. **Standards compliance**: lint the created test files, fix type errors, verify documentation.

Each batch reports: per-file coverage (lines/branches/statements/functions), `tests_created` / `tests_kept` / `tests_deleted`, standards compliance, and whether all files reached target. **Retry rule**: if any batch reports partial or failed, re-batch the incomplete files and dispatch again (still capped at 8 concurrent).

## Sub-step 3 — Remove redundant tests (plan, then parallel removal)

**CRITICAL RULE — source-file-scoped coverage**: each test file mirrors exactly one source file (`src/auth/service.ts` → `spec/auth/service.spec.ts`), and coverage is verified per mirrored source file. A test is redundant ONLY IF it does not contribute to its mirrored source file's coverage. Tests that contribute to their mirrored file MUST be kept even when globally redundant, and tests that verify distinct behavioral aspects must be kept even when they cover the same lines. **Static content is carved out of this gate**: an assertion that restates a value whose source of truth lives elsewhere is removed under `TST-CORE-10` regardless of what it contributes to coverage — it executes code without testing behavior, so its coverage contribution is not evidence of value. A systematic property over that data (bound/cap, uniqueness, ordering, referential integrity, schema validity, cross-source parity, round-trip preservation) is behavior and stays.

**Phase A — plan**: dispatch one Plan subagent (`subagent_type="Plan"`) to read every test file and, per test, determine lines covered, branches exercised, and the unique behavior verified. Redundancy patterns to flag (always scoped to the mirrored source file):

- same logic with different data values that adds neither coverage nor a distinct behavior;
- same lines AND same behavioral aspect as another test;
- artificial scenarios contributing neither coverage nor behavioral documentation;
- wrapper-function tests without unique coverage or insight;
- static-content assertions that restate a value owned elsewhere (constant contents, roster counts, ID mirrors, config maps, copy text) rather than asserting a systematic property over it — flag regardless of coverage contribution (`TST-CORE-10`).

The plan groups candidates by file, marks each `safe_to_remove` | `uncertain` | `keep`, and emits removal tasks (max 10 tests per task, least-risky first).

**Phase B — parallel removal**: dispatch removal subagents (max 8 concurrent). For each assigned test:

1. Pre-removal check: run the mirrored source file's focused coverage; it must read 100%.
2. Remove the single test and save.
3. Re-run the focused coverage and compare.
4. Decide: mirrored coverage maintained → keep removed; dropped (even 1%) → RESTORE immediately and mark `essential`. **Do not restore a static-content assertion** (`TST-CORE-10`): where the removed test was that source's only cover, a dropped percentage is a signal to test the behavior — through the content's consumer or a systematic property over it — not to reinstate a change-detector and stamp it `essential`. Report the gap and write the behavioral test. Before removing, also verify the test does not document a unique behavioral aspect (distinct semantic concept, invariant, or edge case) — if it does, keep it.

Aggregate removal reports, verify 100% is maintained per mirrored source file, and compute redundancy metrics (removed, kept-as-essential, redundancy %).

## Sub-step 4 — Fix test issues & standards compliance

List all test files with filesystem pattern search. ≤25 files → one subagent; >25 files → batches of 10, max 8 concurrent. Each subagent: identify standards violations and logic errors; fix type errors (no `any`), apply the AAA pattern, correct naming, add missing documentation; then verify with the project test, lint, and type-check commands and confirm coverage is unchanged. Retry any batch that leaves issues open.

## Sub-step 5 — Restructure fixtures & test doubles (plan, then execute)

**Phase A — plan**: dispatch one Plan subagent to inventory all test support files (`spec/fixtures/**`, `spec/mocks/**`, inline fixtures/mocks), identify duplication (similar fixture data, repeated mock configurations, inline fixtures that could be shared), assess organization and naming, find unused files (fixtures never imported, mocks never used, factories without references), and emit a restructuring plan: consolidations, organization moves, deletion candidates, and the migration order.

**Phase B — execute**: one subagent for a simple plan, several (max 8) for a complex one:

1. Create the new shared fixture/mock files.
2. Migrate fixtures/mocks from old locations.
3. Update imports in every consuming test file.
4. Remove the old definitions, then delete unused files named by the plan.
5. Verify after each major change: run the tests, fix broken imports, then type-check and lint.

Never leave old and new fixture systems in parallel. Report created/deleted files, consolidation counts, and verification results.

## Sub-step 6 — Closing gates

Run these mechanical gates once per state of the tree — in place, or through `test-runner` when the sweep's raw output would swamp this session; either way that run is authoritative for the files it measured, and no agent is dispatched to re-confirm a result whose inputs have not changed. They do not stand in for the independent final test review in step 8 of `SKILL.md`, which asks the different, behavioral question of what the suite fails to cover.

1. **Coverage**: full coverage command; line/branch/statement/function all meet the target.
2. **Execution**: full test run passes; note flaky tests.
3. **Standards**: lint clean, type-check clean.
4. **Efficiency metrics**: count source files, test files, and total tests; record suite execution time; compute tests per source file and the coverage-per-test ratio. The final report requires these, and deletion and fixture restructuring make them unreconstructable from the baseline and per-batch deltas.

All green → hand off to the independent final test review. Every test-only correction that review justifies invalidates the sweep above, which measured the pre-correction files: rerun the affected gates and the full sweep after the last accepted edit, and let that result complete the workflow. Re-running gates over changed files is not re-confirmation — the earlier result is stale, not doubted. Any failure → return to the sub-step that owns the blocker; report with details only when a blocker is not fixable here.

## Final report shape

Aggregate into one report covering: baseline coverage → batches executed, tests created/kept/deleted → redundancy candidates, removed, kept-essential → issues fixed → fixtures consolidated, unused files deleted → final verified coverage, all-passing status, efficiency metrics, and per-source statements/branches/functions/lines. Name every justified gap.

Include the deduplicated `generated_files` from all subtasks. No child runs file
sizing; after every artifact writer returns, the PM checks only eligible work
Markdown inside the target `.state/`.
