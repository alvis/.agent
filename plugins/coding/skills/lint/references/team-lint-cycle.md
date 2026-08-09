# Team Lint–Review Cycle — lead rules, lifecycle, and convergence

Referenced from SKILL.md Workflow steps 6–8. Defines how the lead runs batches through linter and reviewer teammates.

## Lead rules (orchestration only)

- **DO**: discover files, create batches, spawn teammates, manage lifecycle, aggregate results.
- **DO NOT**: read standard files, run the scanner, apply standards, lint, review, or fix — teammates do all of it. Never `Read` any path containing `standards/`; pass the full standard file paths to teammates as strings.
- **DO NOT** assign new tasks to any agent that reported `context_level` >= 60% — retire it instead.
- Reviewer lifecycle is managed on `ok`/`blocked` + `context_level` reports only. Detailed findings go in a bounded review artifact sent directly to the linter's `agent_id`; they never pass through the lead.

## Agent pool

| Agent | Model | Role | Max concurrent | Lifecycle |
|-------|-------|------|----------------|-----------|
| Lead (skill agent) | opus | Orchestration only | 1 | Entire workflow |
| `linter-N` | haiku | Run the scanner on its batch, apply standards scoped by `--scope`, fix reviewer feedback | 4 | Reused while `context_level` < 60%; waits for reviewer approval when violations were found; requests retirement at >= 60% with fix work remaining |
| `reviewer-N` | sonnet | Independent compliance review (only when violations were found) | 2 | Sends a findings-artifact path directly to the linter; reports `ok`/`blocked` + `context_level` to the lead; reused < 60%, retired >= 60% |

The lead maintains a registry per agent: configured name, returned `agent_id`, role, model, last `context_level`, and status (`working` / `idle` / `retired`). Excess batches queue until a slot frees. Every direct message uses the registry's `agent_id`, never the configured name or role.

## Per-batch lint task contents

Each `TaskCreate` stays at or below 4,096 characters and includes: the absolute standard paths (strings), the batch file list, the `--scope` value and its interpretation (`uncommitted`: `git diff` per file to find changed hunks, lint those ranges plus their enclosing functions/blocks; `all`: whole file; other: a focus hint), the runner command from SKILL.md step 6, and these instructions. If that would exceed the ceiling, put the assignment in a task-owned artifact and dispatch its absolute path plus at most two summary lines.

- confirm every advisory scanner candidate against the matching rule file (`./rules/<rule-id>.md`) before flagging, and follow its Fix section;
- run the project lint/type/test tools after edits — not the scanner again;
- report `violations_found` (integer, `0` when already compliant) and `status: compliant` when zero (distinct from `success`, which means violations were found and fixed);
- report `context_level` (`input_tokens / context_window_size × 100`, default window 200K) in the completion message;
- if violations were found, WAIT for reviewer feedback — no self-claiming new tasks until the lead confirms the batch;
- at `context_level` >= 60%, stop self-claiming and await lead instructions; if reviewers then flag issues, request retirement so a fresh agent takes the fix.

**Do not invent rewrites the standards do not ask for.** A correct direct `error as Error` cast in a catch block is compliant (`TYP-TYPE-08` / `ERR-HAND-04`) — never rewrite it into `instanceof Error ? … : …` narrowing. A whole-error assertion `expect(error).toEqual(new Error('…'))` is compliant (`TST-DATA-07`) — never split it into `toBeInstanceOf` + separate `.message`/`.cause` checks. These rewrites are themselves violations.

## Lint–review cycle (per batch, all batches in parallel)

1. Linter completes and messages the lead its report + `context_level`, then waits.
2. `violations_found` is `0` and `status: compliant` → **skip review entirely**: mark the batch complete, log it "compliant — review skipped", and return the linter to the pool (or retire at >= 60%).
3. `violations_found` > 0 → the lead assigns **2 reviewers** (reuse idle < 60%, else spawn). Each review task names the linted files, the standard paths, and the linter's `agent_id`. Reviewers work independently — they never coordinate with each other.
4. Communication rules: reviewers write detailed findings (issue descriptions, paths, line numbers, expected fixes) to one bounded, secret-free review artifact and send its absolute path plus at most two lines directly to the linter's `agent_id`. They send only `ok` or `blocked` plus `context_level` and the artifact path to the lead's `agent_id`. No message body may exceed 4,096 characters.
5. Either reviewer flags issues:
   - linter `context_level` < 60% → the linter (already holding the findings) fixes and reports back; the lead assigns 2 reviewers again; repeat until both approve.
   - linter `context_level` >= 60% → the lead retires it, spawns a fresh replacement, and sends the durable partial-work and reviewer-artifact paths rather than relaying their contents.
6. Both approve → batch complete; linter returns to pool or retires by `context_level`.

## Aggregate & clean up

1. Wait for every batch cycle to finish, including review-skipped batches.
2. Sum `violations_found` across batches into `violations_found_total`; take the worst status (`failure > partial > success > compliant`).
3. Track reviewed vs review-skipped batch counts and agent lifecycle numbers (spawned, reused, retired).
4. Shut down all remaining teammates and delete the team.

## Iterating until clean with /goal

Iteration is session-level via `/goal`, never looped inside this skill. To lint until clean: `/goal violations_found_total reaches 0 from a fresh /coding:lint pass on src/, or stop after 5 turns`, then invoke the skill. The report's leading `violations_found_total` + `status` keys exist so the goal evaluator (default Haiku) reads convergence directly: `compliant`/`0` signals the goal is met; `success` means violations were fixed this pass and another pass should verify clean state. Unused-code removals from the pre-flight are reported separately and never count toward `violations_found_total` — a one-time prune must not skew convergence.
