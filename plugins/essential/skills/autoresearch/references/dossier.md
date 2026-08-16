# Dossier — persistence contract

This reference defines every file the run writes and the exact schema of each. The loop (`references/loop-workflow.md`)
persists round artifacts the moment they exist; Step 7 synthesizes the final deliverables from them. Because the
schemas below are the only run state, any run is resumable — and auditable — from disk alone.

## Run directory layout

```
<work-dir>/artifacts/autoresearch/<semantic-slug>/
  research-brief.md              # Step 3; append-only ## Amendments thereafter
  leaderboard.md                 # header scaffolded Step 4; rewritten Step 7
  dossier.md                     # Step 7
  best/                          # winning artifact copy
  worktrees/                     # code mode only; ephemeral sandboxes, removed in Step 7
  rounds/round-NN/
    candidates/<cid>/            # one dir per candidate
      artifact.*                 # the candidate itself (code diff, text, config, ...)
      candidate.yaml
    scores.yaml
    verify.yaml                  # refute pass results
    round-log.md                 # appended at Evolve time
```

## candidate.yaml

Written by each generator. Candidate ids are `rNN-cNN` (round, then slot) — stable across resumes and unique
run-wide.

```yaml
id: 'r02-c03'
round: 2
parent_ids: ['r01-c01']          # [] for round-1 / wildcard candidates
framing_direction: '<the direction this lineage descends from>'
mutation: ''                     # the mutation/recombination directive; '' for round 1
generator_intelligence: high|low
artifact_path: 'rounds/round-02/candidates/r02-c03/artifact.md'
summary: '<one line: what this candidate tries>'
```

## scores.yaml

Schema owned by `references/eval-backends.md`: one entry per candidate —
`{backend, raw: [{judge|run, score, reasoning}], consensus, spread, disqualified: null|reason}`.

## verify.yaml

One entry per refute pass (so a round with promotions has several):

```yaml
- candidate_id: 'r02-c03'
  verdict: accepted|refuted
  rationale: '<one line; for refuted, the concrete attack that landed>'
  attack_vectors_checked: [constraint_violation, metric_gaming, harness_bug, rubric_mismatch]
```

## round-log.md format

Appended once per round at Evolve time — the raw material Step 7's dossier agent synthesizes from. Sections, in
order:

1. **What Was Tried** — table: cid / direction / lineage (`parent_ids` + mutation one-liner).
2. **Scores** — table of consensus scores per candidate, plus the best-so-far delta for the round
   (`Δ vs previous best`, on `metric.scale`).
3. **Why the Winner Won** — judge-reasoning synthesis (judges backend) or metric breakdown (programmatic);
   what separated the winner from the runner-up.
4. **Verify Outcome** — verdict per refute pass; disqualifications and promotions spelled out.
5. **Evolve Decision** — survivors carried forward, mutations issued, fanout change (with reason), and budget
   spent (`round N of budget.max_rounds`).

## leaderboard.md format

Ranked top-N table — the run's at-a-glance state:

| rank | cid | round | score | Δ vs baseline | artifact |
|---|---|---|---|---|---|
| 1 | r03-c02 | 3 | 0.91 | +0.17 | [artifact](rounds/round-03/candidates/r03-c02/artifact.md) |

The header is scaffolded once in Step 4 (with the baseline row); the file is fully rewritten in Step 7 from the
final leaderboard state — never hand-patched mid-run.

## dossier.md format

The Step 7 synthesis, written by an xhigh-intelligence agent from the round logs (it reads `rounds/`, not the orchestrator's
memory). Sections, in order:

1. **Executive Summary** — goal, outcome, best score vs baseline vs target, stop reason.
2. **Best Artifact** — path (`best/`) and how to use it (apply the diff, deploy the prompt, ...).
3. **Score Trajectory** — per-round best-score table or ASCII sparkline.
4. **Methodology Recap** — metric, `eval.backend`, `evolution.strategy`, rounds run, fanout history.
5. **Per-Round Insights** — what each round learned: which directions died, which mutations paid off.
6. **Threats to Validity** — every refutation from the verify passes plus residual Goodhart risk (ways the
   metric could still have been gamed that no refuter checked).
7. **Recommendations** — next experiments, directions worth a fresh run, harness improvements.

**Review rule**: before Step 7 completes, a read-only reviewer agent must verify that every score on
`leaderboard.md` traces to a `rounds/round-NN/scores.yaml` entry (matching cid, round, and consensus value). A
leaderboard row with no scores.yaml provenance fails the run's completion gate.
