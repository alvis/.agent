# research-brief.md — template

This is the verbatim template Step 3 renders into the run directory. The brief is the single source of truth for
the entire run: every generator, scorer, verifier, and evolver machine-reads it and nothing else. The orchestrator
writes it **once**, the user approves it before any agent launches, and after that only `## Amendments` is ever
appended — the frontmatter and prose body are immutable for the life of the run.

Contract:

- **Frontmatter is the machine surface.** Agents parse the YAML; the prose body exists for the human and for
  generator context. A field missing from the frontmatter does not exist, no matter what the prose says.
- **MANDATORY fields must be unambiguous before launch.** Step 1 validates a pre-filled brief against the
  checklist below; Step 2's interview exit-criteria enforce the same checklist for interactive runs.
- **Rounds are the primary budget unit.** Token spend is not measurable mid-run, so `budget.max_rounds` is
  MANDATORY and `budget.max_wall_clock_min` is an optional secondary bound.
- **Amendments are append-only.** Every extend/pivot decision from Step 6 lands as a dated entry; nothing above
  it is rewritten.

## Template

```markdown
---
goal: ''                          # MANDATORY — one-sentence optimization goal
artifact_type: code|text|config|model|other   # MANDATORY
metric:
  name: ''                        # MANDATORY
  definition: ''                  # MANDATORY — computable by a third party with no questions
  direction: maximize|minimize    # MANDATORY
  scale: ''                       # MANDATORY (e.g. "0-100", "accuracy 0-1", "ms, lower better")
eval:
  backend: programmatic|judges|human   # MANDATORY
  programmatic:                   # MANDATORY iff backend=programmatic
    command: ''                   # prints exactly one number on stdout
    timeout_s: 600
    setup_command: ''             # optional, run once per worktree
  judges:                         # MANDATORY iff backend=judges
    count: 3                      # min 3, odd
    intelligence: high
    rubric: ''                    # anchored scale points (what a 3 vs 7 vs 9 looks like)
    consensus: median
  human:                          # MANDATORY iff backend=human
    scale: ''
    per_round_batch: 5
baseline:
  artifact: ''                    # MANDATORY — path or 'none' (cold start)
  score: null                     # measured in Step 4 if null
target:
  threshold: null                 # MANDATORY — number on metric.scale
constraints: []                   # MANDATORY — list, or explicit ['none declared']
search_space:
  framing_directions: []          # MANDATORY — >=3 distinct directions seeding round 1
  mutable_paths: []               # code mode: what agents may edit
  immutable_paths: []             # eval command/script auto-added here (anti-gaming)
evolution:
  strategy: genetic               # default | keep_best_regenerate
  top_k: 2
  wildcards_per_round: 1
fanout: { initial: 5, min: 4, max: 8 }
budget:
  max_rounds: 6                   # MANDATORY (primary budget unit)
  max_wall_clock_min: null
plateau: { rounds: 3, epsilon: '' }   # MANDATORY — epsilon = min meaningful improvement
execution:
  code_execution: false           # MANDATORY in code mode — explicit user grant
  worktree_isolation: true        # forced true when code_execution && fanout > 1
output_dir: <work-dir>/artifacts/autoresearch/<semantic-slug>/
---

## Goal

<Narrative restatement of the goal: what artifact is being optimized, why, for whom, and what "better" means in
plain language. Generators read this for intent the metric alone cannot carry.>

## Framing Directions

<One subsection per direction in search_space.framing_directions. Each states the hypothesis behind the direction
and why it might win — the rationale a round-1 generator inherits.>

### <Direction 1>

<Rationale.>

### <Direction 2>

<Rationale.>

### <Direction 3>

<Rationale.>

## Amendments

<Append-only audit trail. One dated entry per Step 6 extend/pivot decision: what changed, why, and the user's
verbatim choice. Never edit prior entries.>

- **<YYYY-MM-DD> — <extend|pivot>**: <what changed and the user decision that authorized it>
```

## Mandatory-field checklist

Step 1 (pre-filled brief validation) and Step 2 (interview exit-criteria) both gate on this exact list. A run may
not reach Step 3 while any item is missing or ambiguous:

1. `goal` — non-empty, one sentence.
2. `artifact_type` — one of the five enum values.
3. `metric.name`, `metric.definition`, `metric.direction`, `metric.scale` — all set; the definition must be
   computable by a third party with no follow-up questions.
4. `eval.backend` — one of the three enum values, **plus** the matching conditional block:
   - `backend: programmatic` → `eval.programmatic.command` set, and it prints exactly one parseable number on
     stdout (verified by the Step 2 dry-run against the baseline).
   - `backend: judges` → `eval.judges.rubric` set with >=3 anchored scale points; `count` >= 3 and odd.
   - `backend: human` → `eval.human.scale` set with stated anchors.
5. `baseline.artifact` — a path that exists, or the literal `'none'` for a cold start. `score` may stay `null`
   (Step 4 measures it).
6. `target.threshold` — a number on `metric.scale`, coherent with `metric.direction`.
7. `constraints` — a list where every entry is checkable (a refuter could rule violation yes/no), or the explicit
   `['none declared']`. An empty list is invalid.
8. `search_space.framing_directions` — >=3 distinct directions, each with a rationale subsection in the body.
9. `budget.max_rounds` — numeric. `max_wall_clock_min` optional.
10. `plateau.rounds` and `plateau.epsilon` — numeric; epsilon is the minimum improvement on `metric.scale` that
    counts as progress.
11. Code mode only (`artifact_type: code` or any candidate must run code): `execution.code_execution` explicitly
    `true` (user-granted, never defaulted), and `search_space.mutable_paths` / `immutable_paths` declared. The
    eval command or script is auto-appended to `immutable_paths` regardless of what the user lists.
