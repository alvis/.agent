---
name: autoresearch
description: 'Run a metric-driven research loop: define a metric, evaluator, baseline, and target; evolve candidate solutions; score and adversarially verify them; then mutate survivors until the target, budget, or plateau ends the run. Use for measurable optimization of prompts, code, experiments, or creative variants; use deep-research for fact-finding.'
metadata:
  intelligence: high
context: fork
argument-hint: "<research-goal-or-brief-path> [--brief=<path>] [--resume=<run-dir>] [--max-rounds=<n>] [--backend=programmatic|judges|human]"
---

# Autoresearch

Turn a fuzzy optimization goal into a user-approved `research-brief.md`, then run
an automated evolve-score-verify loop until the target is met, the round budget
is spent, or progress plateaus — delivering the best artifact plus a research
dossier with a leaderboard and per-round logs. Fact-finding and literature
research belong to `essential:deep-research`.

## Boundaries

- Use for: optimizing anything with a scoreable outcome against a number —
  "optimize this prompt until accuracy reaches 0.90", "get p95 latency under
  200ms", "evolve taglines until the judge panel scores 8.5", candidate
  breeding over code, prompts, configs, models, or creative text, and resuming
  a prior run via `--resume=<run-dir>`.
- Do not use for: literature or web research and fact-finding reports
  (`essential:deep-research`), or goals with no nameable metric the interview
  cannot convert into one.

## Inputs

- **Required**: a plain-language optimization goal, a pre-filled brief path, or
  a run directory — exactly one of the positional argument, `--brief=<path>`,
  or `--resume=<run-dir>` identifies the run.
- **Optional**: `--max-rounds=<n>` overrides `budget.max_rounds` before
  validation (default 6); `--backend=programmatic|judges|human` overrides
  `eval.backend` before validation.
- **Prerequisites**: `backend: programmatic` needs an eval command that prints
  exactly one number on stdout; `backend: judges` needs a rubric the interview
  can anchor; `backend: human` needs the user present each round. Code mode
  (`artifact_type: code`) needs a git repository and an explicit user execution
  grant — never assumed. An ephemeral parallel-execution capability and
  `coding:commit` are both optional; the workflow states the fallback for each.

Before creating or materially rewriting a project artifact, read the absolute
`state.md` path injected by Essential. If unavailable, stop artifact
writes and report the missing contract. Resolve the active work directory from
that contract; a run lives under `artifacts/autoresearch/<semantic-slug>/`.

<IMPORTANT>
- The orchestrator never generates or scores a candidate and never touches the
  eval harness. Every artifact comes from a Generate agent, every score from a
  Score agent or the human, every refutation from a Refuter; the orchestrator
  coordinates, persists, and computes evolution — pure math over `scores.yaml`.
- Generators and scorers never share an agent, a context window, or a prompt;
  judges are fresh spawns blind to siblings, scores, rounds, and each other.
- The eval command, script, rubric, and fixtures are auto-listed in the brief's
  `search_space.immutable_paths` at approval time; a candidate that touches
  them is disqualified on sight.
- No silent caps: every bound that trips — refute-pass limit, fanout clamp,
  `budget.max_rounds`, `plateau` — is logged with its trigger and surfaced.
- A score exists only once written to `scores.yaml` on disk; a candidate is
  exactly as good as its verified consensus score.
</IMPORTANT>

## Workflow

Subagent dispatch in steps 4, 5, and 7 follows
`plugins/governance/standards/delegation/`, tightened by the
brief's own bounds (fanout, judge count, refute passes) named below. Every
first task handover follows
[subagent-handover.md](../../references/directions/subagent-handover.md);
blind roles leave Context empty when additional history would violate their
isolation contract.

1. **Classify the invocation.** `--resume` wins; else `--brief` or a positional
   path resolving to a brief file means a pre-filled brief; else the positional
   is goal text. Record the flag overrides and apply them onto
   `budget.max_rounds` / `eval.backend` before any validation.
   - Resume: verify `<run-dir>/research-brief.md` exists and `rounds/` is
     non-empty, reconstruct `{round, survivors, best, fanout, leaderboard}`
     from the `rounds/round-NN/` files (schemas in
     [references/dossier.md](references/dossier.md)), and jump to step 5. A run
     dir failing either check is not resumable — report it and fall back to
     asking for a goal.
   - Brief: validate every item of the mandatory-field checklist in
     [references/brief-template.md](references/brief-template.md); record each
     failing or ambiguous item as a gap. No gaps → skip to step 3 (the approval
     gate and the step 4 calibration still apply); gaps → step 2 routing only
     the missing fields' domains.
   - Goal: step 2, full adaptive interview seeded with the goal text.
2. **Interview until unambiguous** per
   [references/interview.md](references/interview.md): use the graphical or structured user-input capability in
   batteries of at most 4 questions grouped by domain, every question offering
   a proposed default; answers land only in brief fields and body prose; never
   re-ask. Before exit-criterion (a) passes for `backend: programmatic`, dry-run
   the eval command read-only against the baseline — anything but a single
   parseable number fails the criterion and re-enters the battery with the
   captured output shown to the user. Loop until all six exit-criteria pass; if
   the user aborts, report `status: aborted`.
3. **Write and approve the brief.** Create the run's
   `artifacts/autoresearch/<semantic-slug>/` directory and render
   `research-brief.md` verbatim from the template in
   [references/brief-template.md](references/brief-template.md) — frontmatter
   from the collected values, a `## Goal` narrative, one rationale subsection
   per framing direction, an empty `## Amendments`. Auto-append the eval
   command/script and everything it reads to `search_space.immutable_paths`
   regardless of what the user listed.
   <IMPORTANT>
   Hard gate: no subagent dispatch or parallel-execution launch happens
   anywhere in this skill
   before the user explicitly approves the brief. Present its decision surface
   (metric, backend, baseline, target, budget/plateau, constraints, directions,
   code-execution grant) and ask: approve / edit a field (re-render and
   re-present) / abort. On approval the brief freezes — only `## Amendments`
   is ever appended.
   </IMPORTANT>
4. **Scaffold and calibrate.** Scaffold the run layout once per
   [references/dossier.md](references/dossier.md) (`leaderboard.md` header with
   baseline row, `rounds/`, `best/`, and `worktrees/` in code mode). Then
   smoke-test the harness with one calibration eval of the baseline through
   the chosen backend exactly as a round would score
   ([references/eval-backends.md](references/eval-backends.md)): the full judge
   panel, one use of the graphical or structured user-input capability for the
   human backend, or one mechanical-intelligence evaluator for programmatic.
   - `baseline.artifact: 'none'` (cold start): skip calibration and set the
     baseline score to null — round 1's best initializes the trajectory.
   - A user-asserted `baseline.score` still gets the calibration: it is the
     harness smoke test, not just a measurement.
   - A parseable score becomes the `leaderboard.md` baseline row; the brief's
     `baseline.score` stays untouched — the leaderboard owns measured values.
   - Harness failure after the backend's retry rules: do not fan out — return
     to step 2 targeting the eval fields with the captured output, re-approve
     via step 3, and repeat this step.
5. **Execute the research loop** — rounds of Generate, Score, Verify, Evolve
   per the ordered manifest in
   [references/loop-workflow.md](references/loop-workflow.md): load its shared
   prompt child and exactly one selected mechanism child. Use scoring
   detail in [references/eval-backends.md](references/eval-backends.md) and
   genome breeding, fanout adaptation, and stop checks in
   [references/evolution.md](references/evolution.md). Choose exactly one
   mechanism: A (ephemeral parallel execution) when that capability is available and
   `eval.backend` is programmatic or judges; B (sequential inline) otherwise —
   preferred for the human backend even when parallel execution is available,
   since every round needs user input. Bounds: fanout generators per the brief (adaptive
   4-8, sibling-blind, dispatched in one parallel message under Mechanism B),
   at least 3 (odd) independent judges per candidate, at most 3 refute passes
   per round.
   - On `status: pending_decision` (Mechanism A): `human_scoring` → ask per
     listed candidate on the brief's anchored scale and write the answers into
     `rounds/round-NN/scores.yaml`; `constraint_ambiguity` → ask the contract's
     question and append the ruling to the brief's `## Amendments`; then resume
     through the capability's run-resumption identifier. Repeat until a
     terminal status.
   - Mid-round failures (Mechanism B): retry a failed generator slot once, then
     log the slot as forfeited — the round runs thinner, never silently
     backfilled. A non-scoreable candidate is recorded as
     `disqualified: <reason>` in `scores.yaml`, never dropped.
6. **Handle the stop.** The loop has stopped; nothing runs while you ask.
   Present the stop reason, rounds completed of `budget.max_rounds`, best score
   vs baseline vs `target.threshold`, and the top-3 leaderboard, then ask:
   - **Accept** → step 7.
   - **Extend** → raise `budget.max_rounds` and/or `plateau.rounds` by
     user-chosen amounts → re-enter step 5.
   - **Pivot** → amend directions, constraints, or target via a targeted
     step 2/3 cycle on the changed fields only → re-enter step 5.
   Append every ruling to the brief's `## Amendments` as a dated entry — the
   frontmatter is never rewritten; the resume state carries the effective
   bounds explicitly (via `rounds/` reconstruction or `resumeFromRunId`).
7. **Synthesize and land.** Confirm every round directory carries its
   `scores.yaml`, `verify.yaml`, and `round-log.md`. Dispatch one synthesis
   agent to write `dossier.md` (seven sections in order per
   [references/dossier.md](references/dossier.md), synthesized from the
   `rounds/` files only — never from memory of the run), fully rewrite
   `leaderboard.md` from final state, and copy the winner verbatim into
   `best/`. Then dispatch one read-only provenance reviewer: every leaderboard
   row must trace to a `scores.yaml` entry with matching candidate id, round,
   and consensus value, `best/` must hold the rank-1 artifact, and the dossier
   headline numbers must match disk. On failure, re-dispatch synthesis with the
   fatals attached; at most 2 retries, then report the unresolved rows — a row
   without provenance never ships.
   - Code mode landing (guarded): ask "Apply the winning diff onto HEAD?" with
     the diff stat and verified score. On yes, apply only the winning
     candidate's diff onto HEAD — worktrees are ephemeral sandboxes, never
     committed from — then save it through `coding:commit` when available,
     otherwise leave the diff applied but uncommitted and report that landing
     state. On no, the diff stays in `best/`. Remove `worktrees/` either way.
8. Run the verification below; when a check fails, fix the cause and re-run
   that check. Repeat until every check passes or a concrete blocker remains,
   then report the blocker instead of looping.

## Verification

- The run directory contains the approved brief, `leaderboard.md`,
  `dossier.md`, `best/`, and a complete `rounds/round-NN/` set (`candidates/`,
  `scores.yaml`, `verify.yaml`, `round-log.md`) for every completed round.
- The provenance review passed: every leaderboard score traces to a
  `scores.yaml` entry and `best/` holds the rank-1 artifact.
- The brief's frontmatter and prose body are byte-identical to the approved
  version; only `## Amendments` grew, one dated entry per user ruling.
- Every tripped bound (refute passes, fanout clamps, budget, plateau) appears
  in the round logs with its trigger; `worktrees/` is removed in code mode.

## Completion

<report>

```yaml
status: target_met|accepted_below_target|aborted
metric: { name: ..., baseline: ..., best: ..., target: ..., direction: ... }
rounds_completed: <n>
candidates_evaluated: <n>
stop_reason: target|budget|plateau|user_abort
mechanism: A|B
output_dir: <work-dir>/artifacts/autoresearch/<semantic-slug>/
best_artifact: <path>
user_decisions: [<extend/pivot/accept log>]
generated_files: [<absolute final paths generated or materially rewritten>]
```

</report>

A partial or blocked run still reports this block with `status: aborted`, the
last completed round, and the blocker in place of `best_artifact` commentary.
The PM uses `generated_files` to size-check only eligible work Markdown inside
the target `.state/`.
